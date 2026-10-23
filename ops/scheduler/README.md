# IQ Tests scheduler without a VPS

Target: Cloudflare account `93995a2ee892a5f3efa03bf62c2d31b9`, existing Worker
`supabase-read-health`, Supabase `afsoyuczexiztsjntkvi` only. The account already
has the `inner-code-iq-test` Pages project and an older scheduled health Worker.
Do not create a duplicate or use the global CLI token for the unrelated account
`d08aef3b51fc374db9c4eb76f63ac3f3`.

Status: replacement deployed as version `9a75324d-e1b7-462d-befa-d8ba60126666`;
real scheduled health verification and VPS cutover pending. The matching private
mail function has not been released; mail remains disabled.

## Schedule and boundaries

- `17 */6 * * *`: four health checks/day, 00:17/06:17/12:17/18:17 UTC. Read one
  active test ID through the Data API without caching, homepage, static question
  GIF and a bounded public Storage sample. An empty bucket explicitly skips
  object download. No uploads, simulated users, results, writes or fake commits.
- `*/2 * * * *`: at most 720 mail calls/day, **disabled by default**. After the
  coordinated release, POST `{}` to `send-results-email` with its dedicated
  `RESULT_EMAIL_WORKER_SECRET`. Each call handles at most five due jobs; database
  leases, retry limits and provider idempotency remain in force. The scheduler
  never receives a service-role key, Stripe/Resend key, result token, recipient,
  email body or backup credentials.
- KV `STATUS` retains sanitized `health`/`mail` reports and last success. Failure
  preserves last success and fails the invocation. Partial mail delivery records
  `retry_pending`, not green success. The existing public `/health/supabase` GET/HEAD URL reports only cached health
  freshness (200/503). It cannot run SQL or send email; other paths return 404.
- No automatic resume, upgrades, notifications or payments. Alert destination
  and an independent watchdog remain unconfigured. A stopped scheduler cannot
  alert about its own failure; inspect report age externally.

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

1. Run `pnpm test:scheduler`, `pnpm bundle:scheduler`, and `pnpm lint`. Bundling is
   a dry run and does not deploy to either account.
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
   the same narrow secret is installed on both sides and an approved controlled
   queue test passes. Then set `MAIL_ENABLED=outbox-v1`; update the configuration
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
