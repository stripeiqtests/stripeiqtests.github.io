"""Read-only IQ Tests backups. PostgreSQL 17 + age 1.3.2; no third-party Python packages.

The private age identity belongs on the recovery computer, never on the backup host.
This command never restores SQL or writes to Supabase.
"""
import argparse
import contextlib
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "afsoyuczexiztsjntkvi"
ORIGIN = f"https://{PROJECT}.supabase.co"
MAX_BYTES = 4 * 1024**3
MAX_OBJECTS = 100_000
MAX_JSON = 16 * 1024**2
AGE_VERSION = "v1.3.2"
PAGE_SIZE = 100


class BackupError(Exception):
    """Safe-to-log operational error, without credentials or provider response bodies."""


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def private_file(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise BackupError("Secret/config file must be a regular file")
    if os.name != "nt" and path.stat().st_mode & 0o077:
        raise BackupError("Secret/config file must have mode 0600")
    return path


def private_directory(path):
    path = Path(path)
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.is_symlink() or not path.is_dir():
        raise BackupError("Output must be a real directory")
    if os.name != "nt" and path.stat().st_mode & 0o077:
        raise BackupError("Output directory must have mode 0700")
    return path.resolve()


def checked(command, *, env=None, output=None):
    # PostgreSQL diagnostics can contain queries, connection strings or data.
    # Return only the tool name/status to logs, never raw stdout/stderr on failure.
    try:
        result = subprocess.run(command, env=env, stdout=output or subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=900, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise BackupError(f"{Path(command[0]).name}: unavailable or timed out") from error
    if result.returncode:
        raise BackupError(f"{Path(command[0]).name}: failed ({result.returncode})")
    return result.stdout


def check_age(age):
    if checked([age, "--version"]).decode().strip() != AGE_VERSION:
        raise BackupError("Use the reviewed age v1.3.2 release")


class Database:
    def __init__(self, config):
        host = config["pg_host"]
        direct = host == f"db.{PROJECT}.supabase.co"
        pooler = bool(re.fullmatch(r"aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com", host))
        if not (direct or pooler) or config["pg_user"] != ("postgres" if direct else f"postgres.{PROJECT}"):
            raise BackupError("Database connection is not bound to IQ Tests")
        # A session connection is necessary for a consistent pg_dump snapshot.
        # Do not inherit PGDATABASE, PGSERVICE, PGOPTIONS or a plaintext PGPASSWORD.
        self.env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
        self.env.update(PGHOST=host, PGPORT="5432", PGDATABASE="postgres",
                        PGUSER=config["pg_user"], PGSSLMODE="verify-full",
                        PGSSLROOTCERT=str(Path(config["pg_ssl_root_cert"]).resolve()),
                        PGPASSFILE=str(private_file(config["pg_passfile"]).resolve()),
                        PGCONNECT_TIMEOUT="20",
                        PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=900000 -c lock_timeout=5000")

    def dump(self, directory):
        if not checked(["pg_dump", "--version"]).decode().startswith("pg_dump (PostgreSQL) 17."):
            raise BackupError("PostgreSQL 17 client is required")
        version = checked(["psql", "-XAtw", "-v", "ON_ERROR_STOP=1", "-c", "show server_version_num"], env=self.env)
        if not 170000 <= int(version) < 180000:
            raise BackupError("Database server major version changed; review the restore procedure")
        size = int(checked(["psql", "-XAtw", "-v", "ON_ERROR_STOP=1", "-c",
                            "select pg_database_size(current_database())"], env=self.env))
        if size > MAX_BYTES or shutil.disk_usage(directory).free < size * 2 + 256 * 1024**2:
            raise BackupError("Insufficient disk space or database exceeds the backup budget")
        dump = directory / "database.dump"
        checked(["pg_dump", "--no-password", "--format=custom", "--file", str(dump)], env=self.env)
        roles = directory / "roles.sql"
        with roles.open("xb") as stream:
            checked(["pg_dumpall", "--no-password", "--roles-only", "--no-role-passwords"], env=self.env, output=stream)
        # Verify the archive is readable before spending Storage egress.
        checked(["pg_restore", "--list", str(dump)])
        return {"database.dump": dump, "roles.sql": roles}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Storage:
    def __init__(self, key_file):
        key = private_file(key_file).read_text().strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]{30,4096}", key):
            raise BackupError("Invalid Storage service key file")
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}",
                        "User-Agent": "inner-code-backup/1.0"}
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, path, body=None):
        headers = dict(self.headers)
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(ORIGIN + "/storage/v1" + path,
                                        headers=headers, data=None if body is None else canonical(body))
        try:
            response = self.opener.open(request, timeout=60)
            if response.status != 200:
                response.close()
                raise BackupError("Storage returned an unexpected status")
            return response
        except urllib.error.HTTPError as error:
            code = error.code
            error.close()
            raise BackupError(f"Storage HTTP {code}; no complete backup was created") from None
        except (OSError, urllib.error.URLError):
            raise BackupError("Storage connection failed") from None

    def json(self, path, body=None):
        with self.request(path, body) as response:
            content = response.read(MAX_JSON + 1)
        if len(content) > MAX_JSON:
            raise BackupError("Storage inventory exceeds the JSON budget")
        return json.loads(content)

    def inventory(self):
        buckets = []
        for offset in range(0, 1001, 100):
            page = self.json(f"/bucket?limit=100&offset={offset}&sortColumn=id&sortOrder=asc")
            if not isinstance(page, list) or len(page) > 100:
                raise BackupError("Invalid bucket inventory")
            buckets.extend(page)
            if len(page) < 100:
                break
        else:
            raise BackupError("Too many Storage buckets")
        objects = []
        seen = set()
        bucket_ids = set()
        for bucket in buckets:
            bucket_id = bucket["id"]
            if not isinstance(bucket_id, str) or not bucket_id or bucket_id in bucket_ids:
                raise BackupError("Invalid bucket identifier")
            if bucket.get("type", "STANDARD") != "STANDARD":
                raise BackupError("Nonstandard Storage buckets require a separate reviewed exporter")
            bucket_ids.add(bucket_id)
            folders = [("", 0)]
            visited = set()
            while folders:
                prefix, depth = folders.pop()
                if depth > 32 or prefix in visited or len(visited) >= MAX_OBJECTS:
                    raise BackupError("Storage folder limit exceeded")
                visited.add(prefix)
                for offset in range(0, MAX_OBJECTS + 1, PAGE_SIZE):
                    page = self.json("/object/list/" + urllib.parse.quote(bucket_id, safe=""),
                                     {"prefix": prefix, "limit": PAGE_SIZE, "offset": offset,
                                      "sortBy": {"column": "name", "order": "asc"}})
                    if not isinstance(page, list) or len(page) > PAGE_SIZE:
                        raise BackupError("Invalid Storage listing")
                    for item in page:
                        name = item["name"]
                        if not isinstance(name, str) or not name or "\0" in name:
                            raise BackupError("Invalid Storage object name")
                        full_name = prefix + name
                        if item.get("id") is None:
                            folders.append((full_name + "/", depth + 1))
                            continue
                        identity = (bucket_id, full_name)
                        if identity in seen or len(objects) >= MAX_OBJECTS:
                            raise BackupError("Duplicate object or Storage object limit exceeded")
                        seen.add(identity)
                        size = item["metadata"]["size"]
                        if not isinstance(size, int) or isinstance(size, bool) or size < 0:
                            raise BackupError("Missing Storage object size")
                        objects.append({"bucket": bucket_id, "name": full_name, "id": item["id"],
                                        "updated_at": item.get("updated_at"),
                                        "created_at": item.get("created_at"), "metadata": item["metadata"]})
                    if len(page) < PAGE_SIZE:
                        break
                else:
                    raise BackupError("Storage pagination limit exceeded")
        # Reading a file changes last_accessed_at, so it is deliberately excluded.
        return {"buckets": sorted(buckets, key=lambda b: b["id"]),
                "objects": sorted(objects, key=lambda o: (o["bucket"], o["name"]))}

    def download(self, item):
        path = "/object/authenticated/" + urllib.parse.quote(item["bucket"], safe="")
        path += "/" + urllib.parse.quote(item["name"], safe="/")
        return self.request(path)


class HashReader:
    def __init__(self, stream):
        self.stream, self.digest = stream, hashlib.sha256()

    def read(self, count):
        data = self.stream.read(count)
        self.digest.update(data)
        return data


def create_archive(destination, recipient, files, storage, *, age="age", reserve=256 * 1024**2,
                   initial_inventory=None):
    check_age(age)
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{58}", recipient):
        raise BackupError("A native age X25519 public recipient is required")
    destination = Path(destination)
    parent = private_directory(destination.parent)
    if destination.exists() or set(files) != {"database.dump", "roles.sql"}:
        raise BackupError("Refusing an existing output or invalid database inputs")
    inventory = storage.inventory()
    if initial_inventory is not None and canonical(inventory) != canonical(initial_inventory):
        raise BackupError("Storage changed while the database snapshot was being saved")
    total = sum(item["metadata"]["size"] for item in inventory["objects"])
    total += sum(Path(path).stat().st_size for path in files.values())
    if total > MAX_BYTES or shutil.disk_usage(parent).free < total + reserve:
        raise BackupError("Insufficient disk space or archive exceeds the backup budget")
    manifest = {"format": 1, "project": PROJECT, "started_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "files": {}, "objects": []}
    partial = destination.with_name(destination.name + ".partial")
    process = None
    owned_partial = False
    try:
        with partial.open("xb") as encrypted:
            owned_partial = True
            process = subprocess.Popen([age, "--encrypt", "--recipient", recipient], stdin=subprocess.PIPE,
                                       stdout=encrypted, stderr=subprocess.DEVNULL)
            with tarfile.open(fileobj=process.stdin, mode="w|gz") as archive:
                def add(name, source, size):
                    info = tarfile.TarInfo(name)
                    info.size, info.mode = size, 0o600
                    reader = HashReader(source)
                    archive.addfile(info, reader)
                    if source.read(1):
                        raise BackupError("A source changed size during the backup")
                    manifest["files"][name] = {"size": size, "sha256": reader.digest.hexdigest()}

                for name, path in sorted(files.items()):
                    with Path(path).open("rb") as stream:
                        add(name, stream, Path(path).stat().st_size)
                bucket_data = canonical(inventory["buckets"])
                add("buckets.json", io.BytesIO(bucket_data), len(bucket_data))
                for item in inventory["objects"]:
                    name = "objects/" + hashlib.sha256(canonical([item["bucket"], item["name"]])).hexdigest() + ".bin"
                    with storage.download(item) as stream:
                        add(name, stream, item["metadata"]["size"])
                    manifest["objects"].append({**item, "file": name})
                if canonical(storage.inventory()) != canonical(inventory):
                    raise BackupError("Storage changed during the backup; retry in a quiet upload window")
                manifest["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
                data = canonical(manifest)
                if len(data) > MAX_JSON:
                    raise BackupError("Backup manifest exceeds the budget")
                info = tarfile.TarInfo("manifest.json")
                info.size, info.mode = len(data), 0o600
                archive.addfile(info, io.BytesIO(data))
            process.stdin.close()
            if process.wait(timeout=60) != 0:
                raise BackupError("Encryption failed")
            encrypted.flush()
            os.fsync(encrypted.fileno())
        # No automatic retention/deletion: an incomplete new run must never remove
        # the last good copy. File creation is exclusive and names include a UUID.
        # Hard-link creation is atomic and refuses an existing destination even
        # on Unix, where rename would otherwise overwrite a concurrent file.
        os.link(partial, destination)
        return {"project": PROJECT, "objects": len(inventory["objects"]),
                "plaintext_bytes": total, "archive_bytes": destination.stat().st_size}
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait(timeout=10)
        if process is not None:
            with contextlib.suppress(OSError):
                process.stdin.close()
        if owned_partial:
            partial.unlink(missing_ok=True)


def verify_archive(source, identity, destination, *, age="age"):
    """Authenticate, safely unpack and hash-check; never execute archived SQL."""
    check_age(age)
    identity = private_file(identity)
    source = Path(source)
    if source.is_symlink() or not source.is_file() or source.stat().st_size > MAX_BYTES + MAX_JSON + 64 * 1024**2:
        raise BackupError("Invalid recovery archive or encrypted-size budget exceeded")
    destination = Path(destination).absolute()
    parent = private_directory(destination.parent)
    if destination.exists() or destination.is_symlink():
        raise BackupError("Recovery destination must not exist")
    process = subprocess.Popen([age, "--decrypt", "--identity", str(identity), str(source)],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        # Only this newly created directory beneath the selected parent is ever
        # cleaned up. Archive names cannot select paths, links or destinations.
        with tempfile.TemporaryDirectory(prefix=".verify-", dir=parent) as temporary:
            stage = Path(temporary)
            actual, manifest, total = {}, None, 0
            with tarfile.open(fileobj=process.stdout, mode="r|gz") as archive:
                for member in archive:
                    name = member.name
                    valid = name in {"database.dump", "roles.sql", "buckets.json", "manifest.json"}
                    valid = valid or re.fullmatch(r"objects/[a-f0-9]{64}\.bin", name)
                    if not valid or not member.isfile() or name in actual or member.size < 0:
                        raise BackupError("Unsafe or duplicate archive member")
                    total += member.size
                    if total > MAX_BYTES + MAX_JSON or len(actual) > MAX_OBJECTS + 4:
                        raise BackupError("Recovery archive exceeds the budget")
                    if name in {"manifest.json", "buckets.json"} and member.size > MAX_JSON:
                        raise BackupError("Oversized recovery metadata")
                    target = stage / name
                    target.parent.mkdir(exist_ok=True, mode=0o700)
                    digest = hashlib.sha256()
                    with archive.extractfile(member) as stream, target.open("xb") as output:
                        while chunk := stream.read(1024**2):
                            digest.update(chunk)
                            output.write(chunk)
                    actual[name] = {"size": target.stat().st_size, "sha256": digest.hexdigest()}
                    if name == "manifest.json":
                        manifest = json.loads(target.read_bytes())
            # tar EOF alone does not prove successful age authentication. Drain
            # the decryptor and require its exit status before publishing files.
            while process.stdout.read(1024**2):
                pass
            if process.wait(timeout=60) != 0:
                raise BackupError("Decryption/authentication failed")
            if not isinstance(manifest, dict) or manifest.get("format") != 1 or manifest.get("project") != PROJECT:
                raise BackupError("Wrong project or archive format")
            actual.pop("manifest.json", None)
            if actual != manifest.get("files") or not {"database.dump", "roles.sql", "buckets.json"} <= actual.keys():
                raise BackupError("Recovery file hashes or inventory do not match")
            objects = manifest.get("objects")
            if not isinstance(objects, list) or len(objects) > MAX_OBJECTS:
                raise BackupError("Invalid recovery object inventory")
            object_files, identities = set(), set()
            for item in objects:
                expected = "objects/" + hashlib.sha256(canonical([item["bucket"], item["name"]])).hexdigest() + ".bin"
                identity_pair = (item["bucket"], item["name"])
                if item["file"] != expected or expected not in actual or expected in object_files or identity_pair in identities:
                    raise BackupError("Invalid recovery object mapping")
                if item["metadata"]["size"] != actual[expected]["size"]:
                    raise BackupError("Recovery object size does not match")
                object_files.add(expected)
                identities.add(identity_pair)
            if {name for name in actual if name.startswith("objects/")} != object_files:
                raise BackupError("Unlisted recovery object")
            # Rename publishes only a fully authenticated, verified directory.
            stage.rename(destination)
            return {"project": PROJECT, "objects": len(objects), "verified_files": len(actual)}
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=10)
        process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--config", required=True)
    verify = commands.add_parser("verify")
    verify.add_argument("--archive", required=True)
    verify.add_argument("--identity", required=True)
    verify.add_argument("--destination", required=True)
    args = parser.parse_args()
    try:
        if args.command == "verify":
            report = verify_archive(args.archive, args.identity, args.destination)
        else:
            config = json.loads(private_file(args.config).read_bytes())
            if config["project"] != PROJECT:
                raise BackupError("Wrong project")
            output = private_directory(config["output_directory"])
            database = Database(config)
            storage = Storage(config["storage_key_file"])
            import uuid
            name = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            destination = output / f"{PROJECT}-{name}-{uuid.uuid4()}.tar.gz.age"
            with tempfile.TemporaryDirectory(prefix=".dump-", dir=output) as directory:
                initial_inventory = storage.inventory()
                files = database.dump(Path(directory))
                report = create_archive(destination, config["age_recipient"], files, storage,
                                        initial_inventory=initial_inventory)
            report["archive"] = destination.name
        print(json.dumps({"status": "ok", **report}))
        return 0
    except BackupError as error:
        print(json.dumps({"status": "error", "error": str(error)}))
    except Exception:
        # Malformed configuration/HTTP payload/archive errors must not disclose
            # connection information, credentials, result links or personal data.
        print(json.dumps({"status": "error", "error": "Backup/recovery failed; no complete output published"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
