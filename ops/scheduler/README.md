# IQ Tests scheduler without a VPS

Target: Cloudflare account `93995a2ee892a5f3efa03bf62c2d31b9`, existing Worker
`supabase-read-health`, Supabase `afsoyuczexiztsjntkvi` only. The account already
has the `inner-code-iq-test` Pages project and an older scheduled health Worker.
Do not create a duplicate or use the global CLI token for the unrelated account
`d08aef3b51fc374db9c4eb76f63ac3f3`.

Status: health cutover first passed with version
`8e34c58b-9552-4bd2-88c2-b0f1ee8ddab5`; current mail release is
`42e477c3-3363-4166-a588-55e0b040a1db` after explicit dispatch approval.
A real Cloudflare scheduled health run passed at 08:59:08 UTC on 2026-10-23
(11:59:08 Europe/Minsk), persisted in KV, 3 ms CPU. Public status returns 200.
The old IQ Tests VPS timer is disabled/inactive; Telegraph services stay active.
Temporary minute scheduling was removed; stale probe invocations stop doing work
after their ten-minute window even during Cron propagation. The private `result-email-worker` endpoint is deployed and rejects public calls.
The scheduled mail path now uses approved `MAIL_ENABLED=outbox-v1`. Its first
real delivery-mode run passed at 10:00:13 UTC on 2026-10-23 (13:00 Minsk),
processed=0/sent=0 because the queue was empty. Actual provider/inbox delivery
therefore remains untested. The preceding readiness report passed at 09:46:26
UTC; `preflight-v1` remains a diagnostic mode with no claims/writes/provider calls.
`verify-payment` version 13 now commits paid access/outbox without inline mail.
Already-paid legacy results retain their existing capability and do not enqueue
a historical copy. Fresh-process CLI checks verified the saved isolated login
and both active functions. See `audit/mail-queue-rollout-2026-10-23.json` and
the preceding `audit/monitoring-cloudflare-2026-10-23.json`.

## Schedule and boundaries

- `17 */6 * * *`: four health checks/day, 00:17/06:17/12:17/18:17 UTC. Read one
  active test ID through the Data API without caching, homepage, static question
  GIF and a bounded public Storage sample. An empty bucket explicitly skips
  object download. No uploads, simulated users, results, writes or fake commits.
- `*/2 * * * *`: at most 720 mail calls/day, **delivery enabled with explicit approval**.
  POST `{}` to `result-email-worker` with its dedicated
  `RESULT_EMAIL_WORKER_SECRET`. Each call handles at most five due jobs; database
  leases, retry limits and provider idempotency remain in force. The scheduler
  never receives a service-role key, Stripe/Resend key, result token, recipient,
  email body or backup credentials.
- KV `STATUS` retains sanitized `health`/`mail` reports and separate `mail_preflight` readiness reports and last success. Failure
  preserves last success and fails the invocation. Partial mail delivery records
  `retry_pending`, not green success. The existing public `/health/supabase` GET/HEAD URL reports only cached health
  freshness (200/503). It cannot run SQL or send email; other paths return 404.
- No automatic resume, upgrades, notifications or payments. An existing UptimeRobot monitor was observed polling the preserved health URL.
  Its alert destination and delivery have not been verified. A stopped scheduler
  cannot alert about its own failure; the URL returns 503 when its report ages.

This uses two of Workers Free's five account Cron Triggers. At most 724 KV writes
per day fit the current free 1,000/day quota, **shared with other account use**.
No paid subscription is required. Inspect actual account-wide quota/CPU use:
Workers Free allows 10 ms CPU/invocation; network waiting is separate. Response
parsing and Storage listing are bounded.

Cloudflare runs independently of a paused Supabase project and repository idle
time. Supabase Cron stops with its project; public GitHub schedules can disable
after 60 idle days. Useful periodic reads reduce inactivity risk but do not
guarantee exemption from provider pausing. Backups/recovery remain necessary.

## Deployment and cutover

1. Run `pnpm test:scheduler`, `pnpm test:scheduler-runtime`, and `pnpm lint`.
   Runtime tests execute the exact deploy bundle in workerd with all outbound
   requests intercepted. They verify real Fetch/stream/KV behavior and rejection
   of redirects; Node-only mocks cannot prove Workers API compatibility. Bundling
   is a dry run and does not deploy to either account.
2. Authenticate Wrangler to Adrian with Workers scripts/KV and read-only
   account/user/tail permissions. Check `wrangler whoami` with the unrelated
   environment token removed **for that process only**. Do not overwrite other
   projects' credentials.
3. The preceding Worker source/settings were saved before replacement. It used
   the same six-hour Cron and read only an active test ID. Dedicated KV namespace
   `80a6a5eabf0a45c0b261ac2be4ade4a4` is now bound as `STATUS`; its public ID is
   committed in `wrangler.json`. Never seed a fabricated green production report.
4. Deploy reviewed code/config with mail disabled. Enable mail only after the
   matching private Supabase function is deployed, public requests return 403,
   the same narrow secret is installed on both sides and dispatch is explicitly
   approved. Provider acceptance/inbox delivery still need separate observation. A `preflight-v1` schedule can safely verify private authentication/configuration
   first: it never claims or sends jobs and saves a separate `mail_preflight`
   report. After explicit dispatch approval, set `MAIL_ENABLED=outbox-v1`; update the configuration
   for subsequent deploys so that choice is preserved.
5. Verify an actual scheduled health run in Cloudflare and its KV report,
   including checks/skips and Free CPU/errors. A local dry run is insufficient.
   `* * * * *` is accepted only for an explicitly approved, bounded cutover probe.
   It is absent from normal configuration and must be removed in a finally step.
   The public status may return 503 until the first real successful run.
6. Then disable only `inner-code-health.timer` on the old VPS with
   `systemctl disable --now inner-code-health.timer`, verify disabled/inactive,
   and retain previous files/status. Do not change Telegraph services.

## Freshness and recovery

Read `health` through Cloudflare Dashboard or authenticated Wrangler KV CLI.
`inspectStatus` rejects malformed/future/failed reports and reports older than
eight hours. `ops/health/healthcheck.py --status-file FILE` accepts the health
JSON and performs no network calls. Once mail is enabled, its report should be
no older than ten minutes. Check `retry_pending`, errors and failed outbox rows
separately. `sent` means provider acceptance, not confirmed inbox delivery.

If a release fails, restore the preceding reviewed Cloudflare version with its
Cron/bindings, leaving mail disabled until the function contract is verified.
Retain paid access/outbox. Do not restore a dependence on the Telegraph VPS.
Source/configuration and actual cutover evidence belong in Git, secrets do not.
Backups are a separate operator task in `BACKUP_RECOVERY.md`.

References:
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/kv/platform/limits/
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## CLI account isolation

Native Supabase CLI `--profile` did not keep a stable identity through the shared
Windows keyring during this rollout: a later command resolved a different
organization and the fixed IQ project ref correctly produced 403. Do not deploy
from that context or read credentials out of Credential Manager. Use the
operator-approved isolated `SUPABASE_HOME` directory with a private ACL and
`SUPABASE_NO_KEYRING=1`, complete the normal CLI login there, then assert that
`projects list` contains `afsoyuczexiztsjntkvi` before each release command.
The private home/access token never belongs in Git or chat. A local operator
wrapper now fixes the home/profile, clears any ambient access token for its own
process, asserts the exact project/name/organization and restores the preceding
environment afterwards. Two fresh invocations confirmed persisted access; a
new login is only needed if the credential expires, is revoked or is removed.
The local wrapper and auth directory are retained outside this repository.
