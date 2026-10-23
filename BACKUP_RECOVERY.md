# Encrypted backup and recovery

Status: **implementation and isolated restore drill; not configured on production**.
There is no verified live backup yet. No paid Supabase plan is required by these
tools. This does not guarantee that a free project will never be paused.

## Contents and boundaries

`ops/backup/backup.py create` reads **IQ Tests / afsoyuczexiztsjntkvi** only. It
saves a PostgreSQL 17 custom archive (schema, data, grants, policies/functions,
Auth/Storage metadata included when the database role can read them), role
definitions **without passwords**, bucket settings and the actual bytes of every
listed ordinary Storage object, including nested folders and private buckets.
It fails if any database command or object download fails. It never treats a
partial export as a complete backup. Vector/analytics buckets are not supported;
review them separately if those services are introduced.

The tar stream is encrypted with the reviewed official **age v1.3.2**, using a
public X25519 recipient. Objects stream directly into encryption. The database
dump is staged in a private directory and removed after the run. Encrypted
archives contain a manifest with per-file SHA-256/size and original object
metadata. Raw SQL, results, email addresses, tokens and provider error bodies
are never printed. The private decryption identity is **not** needed on the
backup VPS. Keep it on the recovery computer and in a second private offline
location; losing it makes the archives unusable.

A power loss or forced termination can leave a private `.dump-*` work directory
or `.partial` archive. These are not valid copies. Inspect/remove only abandoned
work directories after confirming no backup job is active; never delete the
last verified archive as part of failure cleanup.

PostgreSQL has its own consistent snapshot. A database dump and Storage API
downloads do **not** share an atomic transaction. The tool compares complete
Storage inventories before the database dump, before downloading and after
downloading; changes abort the run. Use a quiet window for administrator uploads
and deletions. This comparison cannot prove atomicity against every possible
external writer or an adversary reverting metadata.

The script has a 4 GiB total plaintext budget, bounded listing/manifest sizes and
disk-space checks. This is an application limit, not an allowance from Supabase.
Budget actual database size, Storage egress and VPS free disk before enabling a
schedule. The existing small VPS needs review if the dataset grows. Weekly full
copies are the initial template; make another copy before risky changes. No
automatic deletion is enabled: a failed run must not remove the last good copy.
After verifying copies, set a retention policy appropriate to disk and privacy
requirements. Keep at least one encrypted copy on another machine/provider.

The archive does not contain Edge source/deployments, secret values, project
configuration, DNS, Stripe/Resend account settings or encrypted Vault root keys.
Source is in Git; store provider configuration/recovery instructions separately
and reset passwords/secrets through the corresponding provider during recovery.
Do not claim an entire Supabase service is restored by restoring PostgreSQL.

## Configure only after the operator supplies credentials

1. Install PostgreSQL **17** clients (`psql`, `pg_dump`, `pg_dumpall`, `pg_restore`)
   and official age **v1.3.2**. Use the official signed/checksummed release, not an
   arbitrary download. `ops/backup/install_age.py` pins Linux/Windows x86-64 asset
   hashes and installs only the two executables into an explicit directory; it
   does not modify system PATH. The fixture runner uses an ignored local folder.
2. On the **recovery computer**, run `age-keygen -o age-identity.txt`, protect that
   file, and copy only the public `age1…` recipient to backup configuration.
   Test it with a fixture archive first. Do not paste the identity into chat/Git
   or install it on the VPS. Windows requires a private ACL; Unix requires 0600.
3. In the correct Supabase project's Connect panel obtain the session pooler
   hostname or direct IPv6 hostname and the trusted database CA certificate.
   `pg_host` allows only this project's direct hostname or a Supabase session
   pooler with `pg_user=postgres.afsoyuczexiztsjntkvi`. Port is fixed to 5432,
   database to `postgres`; TLS certificate/hostname verification is required.
   A transaction pooler (6543), implicit CLI-linked project or inherited
   `PGSERVICE`/`PGPASSWORD` is never used.
4. The operator provides a PostgreSQL password via a **0600** pgpass file in the
   normal `host:5432:postgres:user:password` format, with libpq escaping for `:`
   and `\\`. Also provide a **0600** file containing the project's server-side
   Storage service key. Never use a frontend publishable key for private Storage
   export. These privileged credentials must not enter Git, command arguments,
   public monitors or logs. Windows ACL protection is an operator prerequisite;
   the portable script can enforce Unix mode bits only.
5. Copy `ops/backup/config.example.json` to the private host configuration and
   fill its public recipient/host/certificate path. The service template expects
   root-owned files in `/etc/inner-code-backup/`: `config.json`, `db.pgpass` and
   `storage-key` (0600). systemd `LoadCredential` provides private runtime copies
   to the dynamic service user; the CA certificate is public read-only material.
   Install the reviewed script at `/opt/inner-code-backup/backup.py` and ensure
   pinned tools are on the service's PATH.
6. Review/install the `.service` and `.timer` templates. Run the service manually
   **before enabling the timer**, check its JSON `status=ok`, and securely copy
   the encrypted archive from the service's StateDirectory to the recovery
   computer. Do not turn on the schedule until the following live restore drill
   succeeds. Check systemd exit status/journal and archive age; notifications and
   a maximum backup-age alert still need an operator-selected destination.

For a manual run, use a private configuration whose file paths point to the
operator's protected local files:

```text
python3 ops/backup/backup.py create --config /private/backup.config.json
```

Only an authenticated full run produces the final `.tar.gz.age`; `.partial`
does not count. Encryption proves confidentiality/integrity for the intended
recipient; it does not establish the identity of the backup producer. Protect
backup write access and record the archive hash through a trusted channel.

## Verify and drill recovery without touching the live project

```text
python3 ops/backup/backup.py verify --archive /private/copy.tar.gz.age --identity /private/age-identity.txt --destination /private/new-recovery-directory
pg_restore --list /private/new-recovery-directory/database.dump
```

The destination must not exist. `verify` authenticates the complete age stream,
rejects unexpected paths/links/duplicates, checks every size/hash and object
mapping, and publishes the recovery directory only on success. It **never**
executes SQL, restores database roles, creates buckets or uploads objects.
Decrypted output is sensitive: keep its parent private (0700 on Unix/private ACL
on Windows), then remove it after the drill under the operator's retention policy.

Restore SQL only into a **new isolated** PostgreSQL 17/Supabase test target with
network calls, scheduled jobs and outgoing email/payments disabled. Inspect the
archive with `pg_restore --file` first. A dump can contain executable functions.
Platform extensions and managed roles must already exist. Do not blindly replay
`roles.sql` over Supabase's reserved roles or use `--clean` against production.
For a fresh PostgreSQL fixture, the tested data restore is:

```text
pg_restore --exit-on-error --single-transaction --dbname ISOLATED_DATABASE database.dump
```

For a new hosted Supabase project, review the current provider migration guide
and reconcile managed `auth`/`storage` schemas, grants, extensions, encryption
keys and custom triggers/policies before selecting restore entries. Our full
archive preserves these definitions for inspection; it is not a one-command
managed-project migration. Restore ordinary Storage bucket configuration from
`buckets.json`, then upload each manifest object from its hashed `file` path to
the original `bucket`/`name` through the **isolated project's Storage API**. Preserve
MIME/cache metadata. Reconcile existing metadata records instead of blindly
duplicating `storage.objects`. The supplied verifier deliberately performs none
of these remote mutations automatically.

Acceptance: compare questions, tests (including archived), settings, sessions,
orders/outbox, attempt versions, private-table RLS/grants and paid/unpaid capability
behavior; read every restored illustration and compare its hash. A local database
drill with mocked Storage HTTP is evidence of the tooling, not a live Supabase
Auth/Storage recovery. Schedule periodic live-data drills on a separate test
project once credentials, encryption-key custody and isolation are configured.

## Automated fixture evidence

`pnpm test:backup` tests actual age encryption/decryption against isolated bytes:
wrong key, ciphertext tampering/truncation (including final authentication),
validly encrypted but inconsistent file hashes, unsafe paths/symlinks/duplicates,
wrong project, interrupted/changing Storage, pagination/nested Unicode names,
short/oversized downloads, low disk and preservation of previous output.

`pnpm test:database` additionally encrypts a **real PostgreSQL 17** custom archive,
verifies/extracts it, restores into a fresh isolated database and compares data,
policies and critical access grants. It checks the retired legacy submission
permission and anonymous pinned API again after recovery. Cluster roles are the
fixture's existing platform baseline. Storage transport is a fixture and its
actual archived bytes are hash-checked; this does not exercise a hosted Storage
service. Nothing contacts production or sends email/payments.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups),
[managed-project restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[official age release](https://github.com/FiloSottile/age/releases/tag/v1.3.2).
