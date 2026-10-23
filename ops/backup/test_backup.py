"""Actual age encryption/recovery; mocked Storage transport, optional real pg_dump.

No production credentials, queries, uploads, payments or mail are used.
"""
import argparse
import copy
import hashlib
import http.server
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import threading
import unittest
from unittest.mock import patch

import backup

parser = argparse.ArgumentParser()
parser.add_argument("--tools", required=True)
parser.add_argument("--database-dump")
parser.add_argument("--roles")
parser.add_argument("--recovery-directory")
options, remaining = parser.parse_known_args()
tool_suffix = ".exe" if os.name == "nt" else ""
AGE = str(Path(options.tools) / ("age" + tool_suffix))
KEYGEN = str(Path(options.tools) / ("age-keygen" + tool_suffix))


class FakeStorage:
    def __init__(self):
        self.content = b"GIF89a" + bytes(range(256)) * 1000
        self.calls = 0
        self.change_on = None
        self.fault = None
        self.value = {"buckets": [{"id": "images", "public": True}],
                      "objects": [{"bucket": "images", "name": "nested/фото #1.gif", "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                                   "updated_at": "2026-10-23T00:00:00Z", "created_at": "2026-10-22T00:00:00Z",
                                   "metadata": {"size": len(self.content), "mimetype": "image/gif"}}]}

    def inventory(self):
        self.calls += 1
        value = copy.deepcopy(self.value)
        if self.calls == self.change_on:
            value["objects"][0]["updated_at"] = "2026-10-24T00:00:00Z"
        return value

    def download(self, _item):
        if self.fault:
            raise backup.BackupError("Injected unavailable Storage")
        return io.BytesIO(self.content)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="inner-code-backup-fixture-")
        self.root = Path(self.temporary.name)
        self.root.chmod(0o700)
        self.identity, self.recipient = self.key("identity.txt")
        self.storage = FakeStorage()
        self.dump, self.roles = self.root / "database.dump", self.root / "roles.sql"
        self.dump.write_bytes(b"PGDMP isolated database fixture")
        self.roles.write_bytes(b"-- no passwords\nCREATE ROLE anon NOLOGIN;\n")
        self.files = {"database.dump": self.dump, "roles.sql": self.roles}
        self.archive = self.root / "fixture.tar.gz.age"

    def tearDown(self):
        self.temporary.cleanup()

    def key(self, name):
        identity = self.root / name
        subprocess.run([KEYGEN, "-o", str(identity)], check=True, capture_output=True)
        identity.chmod(0o600)
        public = subprocess.run([KEYGEN, "-y", str(identity)], check=True, capture_output=True).stdout.decode().strip()
        return identity, public

    def create(self):
        return backup.create_archive(self.archive, self.recipient, self.files, self.storage, age=AGE, reserve=0)

    def verify(self, destination=None, identity=None):
        return backup.verify_archive(self.archive, identity or self.identity,
                                     destination or self.root / "recovered", age=AGE)

    def repack(self, mutate):
        raw = subprocess.run([AGE, "-d", "-i", str(self.identity), str(self.archive)], check=True, capture_output=True).stdout
        entries = []
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
            for member in archive:
                entries.append((member, archive.extractfile(member).read()))
        entries = mutate(entries)
        result = io.BytesIO()
        with tarfile.open(fileobj=result, mode="w:gz") as archive:
            for member, data in entries:
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        encrypted = subprocess.run([AGE, "-r", self.recipient], input=result.getvalue(), check=True, capture_output=True).stdout
        self.archive.write_bytes(encrypted)

    def rejected(self):
        with self.assertRaises((backup.BackupError, tarfile.TarError, EOFError, OSError)):
            self.verify()
        self.assertFalse((self.root / "recovered").exists())
        self.assertFalse(list(self.root.glob(".verify-*")))

    def test_encrypt_recover_database_and_unicode_storage_bytes(self):
        self.assertEqual(self.create()["objects"], 1)
        self.assertNotIn(b"PGDMP isolated", self.archive.read_bytes())
        self.assertEqual(self.verify()["verified_files"], 4)
        recovered = self.root / "recovered"
        self.assertEqual((recovered / "database.dump").read_bytes(), self.dump.read_bytes())
        manifest = json.loads((recovered / "manifest.json").read_bytes())
        self.assertEqual((recovered / manifest["objects"][0]["file"]).read_bytes(), self.storage.content)

    def test_wrong_key_ciphertext_tampering_and_truncation(self):
        self.create()
        wrong, _ = self.key("wrong.txt")
        with self.assertRaises((backup.BackupError, tarfile.TarError, EOFError)):
            self.verify(identity=wrong)
        original = self.archive.read_bytes()
        # Includes loss of the final authenticated chunk after tar data exists.
        for content in [original[:-1], original[:-64], original[:-1] + bytes([original[-1] ^ 1])]:
            self.archive.write_bytes(content)
            self.rejected()

    def test_authenticated_archive_still_requires_matching_file_hashes(self):
        self.create()
        def change(entries):
            return [(member, data + b"altered" if member.name == "database.dump" else data) for member, data in entries]
        self.repack(change)
        self.rejected()

    def test_archive_paths_symlinks_duplicates_and_wrong_project(self):
        for mode in ["path", "symlink", "duplicate", "project"]:
            self.archive.unlink(missing_ok=True)
            self.create()
            def change(entries):
                if mode == "project":
                    output = []
                    for member, data in entries:
                        if member.name == "manifest.json":
                            manifest = json.loads(data)
                            manifest["project"] = "wrong-project"
                            data = backup.canonical(manifest)
                        output.append((member, data))
                    return output
                if mode == "duplicate":
                    return entries + [entries[0]]
                member = tarfile.TarInfo("../outside" if mode == "path" else "roles.sql")
                if mode == "symlink":
                    member.type, member.linkname = tarfile.SYMTYPE, "../outside"
                return [(member, b"")] + entries
            self.repack(change)
            self.rejected()
        self.assertFalse((self.root.parent / "outside").exists())

    def test_storage_failure_or_changes_never_publish_a_backup(self):
        for kind in ["failure", "changed", "short", "extra"]:
            self.storage = FakeStorage()
            if kind == "failure":
                self.storage.fault = True
            elif kind == "changed":
                self.storage.change_on = 2
            elif kind == "short":
                self.storage.content = self.storage.content[:-1]
            else:
                self.storage.content += b"extra"
            with self.assertRaises((backup.BackupError, OSError)):
                self.create()
            self.assertFalse(self.archive.exists())
            self.assertFalse(self.archive.with_name(self.archive.name + ".partial").exists())

    def test_existing_outputs_and_low_disk_are_preserved(self):
        self.archive.write_bytes(b"previous good backup")
        with self.assertRaises(backup.BackupError):
            self.create()
        self.assertEqual(self.archive.read_bytes(), b"previous good backup")
        self.archive.unlink()
        with patch("backup.shutil.disk_usage", return_value=type("Disk", (), {"free": 0})()):
            with self.assertRaises(backup.BackupError):
                self.create()
        self.assertFalse(self.archive.exists())
        self.create()
        destination = self.root / "recovered"
        destination.mkdir()
        (destination / "keep").write_bytes(b"existing")
        with self.assertRaises(backup.BackupError):
            self.verify()
        self.assertEqual((destination / "keep").read_bytes(), b"existing")

    def test_wrong_database_and_inherited_pg_settings_are_rejected(self):
        pgpass = self.root / "fixture.pgpass"
        pgpass.write_text("fixture-only")
        pgpass.chmod(0o600)
        config = {"pg_host": "db.wrong.supabase.co", "pg_user": "postgres", "pg_passfile": str(pgpass),
                  "pg_ssl_root_cert": str(self.root / "root.crt")}
        with self.assertRaises(backup.BackupError):
            backup.Database(config)
        config["pg_host"] = f"db.{backup.PROJECT}.supabase.co"
        with patch.dict(os.environ, {"PGPASSWORD": "must-not-be-inherited", "PGSERVICE": "wrong-project"}):
            database = backup.Database(config)
        self.assertNotIn("PGPASSWORD", database.env)
        self.assertNotIn("PGSERVICE", database.env)
        self.assertEqual(database.env["PGSSLMODE"], "verify-full")

    def test_paginated_recursive_storage_and_unicode_download(self):
        storage = object.__new__(backup.Storage)
        seen = []
        def listing(path, body=None):
            seen.append((path, body))
            if path.startswith("/bucket"):
                return [{"id": "images", "public": False}]
            if body["prefix"] == "":
                return [{"name": "nested", "id": None}]
            if body["offset"] == 0:
                return [{"name": f"{i:04d}.gif", "id": str(i), "metadata": {"size": 6}} for i in range(100)]
            return [{"name": "фото #1.gif", "id": "last", "metadata": {"size": 6}}]
        storage.json = listing
        inventory = storage.inventory()
        self.assertEqual(len(inventory["objects"]), 101)
        self.assertTrue(any(body and body["offset"] == 100 for _, body in seen))
        paths = []
        storage.request = lambda path: paths.append(path)
        storage.download(inventory["objects"][-1])
        self.assertIn("%D1%84%D0%BE%D1%82%D0%BE%20%231.gif", paths[0])

    def test_storage_redirect_is_not_followed_or_logged(self):
        requests = []
        class RedirectHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.path)
                self.send_response(302)
                self.send_header("Location", "/must-not-receive-credentials")
                self.end_headers()
                self.wfile.write(b"secret-provider-diagnostics")

            def log_message(self, *_args):
                pass

        key = self.root / "storage-key"
        key.write_text("fixture-key-only-" + "x" * 40)
        key.chmod(0o600)
        with http.server.ThreadingHTTPServer(("127.0.0.1", 0), RedirectHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with patch("backup.ORIGIN", f"http://127.0.0.1:{server.server_port}"):
                    with self.assertRaises(backup.BackupError) as error:
                        backup.Storage(key).request("/bucket")
                self.assertEqual(requests, ["/storage/v1/bucket"])
                self.assertNotIn("secret-provider", str(error.exception))
                self.assertNotIn(key.read_text(), str(error.exception))
            finally:
                server.shutdown()
                thread.join(timeout=5)

    def test_inventory_change_during_database_dump_is_rejected(self):
        initial = self.storage.inventory()
        self.storage.change_on = 2
        with self.assertRaises(backup.BackupError):
            backup.create_archive(self.archive, self.recipient, self.files, self.storage,
                                  age=AGE, reserve=0, initial_inventory=initial)
        self.assertFalse(self.archive.exists())

    @unittest.skipUnless(options.database_dump, "Real PostgreSQL archive is supplied by test:database")
    def test_actual_postgresql_archive_for_restore_drill(self):
        self.files = {"database.dump": Path(options.database_dump), "roles.sql": Path(options.roles)}
        self.create()
        destination = Path(options.recovery_directory)
        self.verify(destination=destination)
        self.assertEqual(hashlib.sha256((destination / "database.dump").read_bytes()).digest(),
                         hashlib.sha256(Path(options.database_dump).read_bytes()).digest())


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0], *remaining], verbosity=2)
