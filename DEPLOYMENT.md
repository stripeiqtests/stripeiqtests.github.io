# IQ Test — secure deployment

> **2026-10-22 audit release:** read `AUDIT_REMEDIATION.md` and
> `PAYMENT_ROLLOUT.md` first. Production has manually applied SQL and no reconciled
> CLI migration history. Do not blindly run the historical `db push` instructions
> below. The explicitly approved `20261022190000_audit_safety.sql` and
> `20261022200000_payment_fulfillment.sql` have been applied and verified.
> Matching payment functions and frontend release remain pending.

The application is a static React frontend backed by Supabase, Stripe and
Resend. Test takers do not need accounts. Administrators sign in through
Supabase Auth.

## 1. Confirm the production target

The live application uses Supabase project `afsoyuczexiztsjntkvi`. The paused
legacy project `movuagoqspojzshirvuz` must never receive this deployment.

Before every remote command, link with an owner/developer account and run the
repository guard:

```bash
pnpm exec supabase link --project-ref afsoyuczexiztsjntkvi
pnpm verify:production-target
```

Stop if the guard fails. Do not work around it by editing the expected project
ID.

## 2. Create the administrator before changing RLS

Create the administrator in Supabase Dashboard under Authentication → Users.
Set a strong password and add one of these values to the user's app metadata:

```json
{ "role": "admin" }
```

or:

```json
{ "is_admin": true }
```

Do not store an administrator password in `app_settings`, SQL, frontend code or
documentation. Sign out and in after changing app metadata so the JWT is
refreshed. Verify the account can sign in before the coordinated rollout; the
RLS migration removes the old shared-password path.

## 3. Rotate previously exposed credentials

Before the next production deployment, revoke and replace the Stripe secret
that previously appeared in this repository. Review the repository history and
any private exports before sharing it; deleting a value from the current tree
does not remove it from old commits. Store replacement credentials only as
Supabase Edge Function secrets.

Required secrets:

- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `APP_DOMAIN` — the exact public application origin, for example
  `https://example.com`
- `RICH_TEXT_COMPATIBILITY_MODE` — optional email-rendering rollback flag;
  leave unset or `false` by default

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed
functions. Do not put service-role or Stripe secrets in `VITE_*` variables.

## 4. Prepare a coordinated rollout

The database, Edge Functions and frontend form one security contract. The old
frontend cannot submit through the new locked-down database, and the old
checkout payload is rejected by the new function. Build everything first and
use a short low-traffic maintenance window rather than leaving a mixed version
running.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test:security
pnpm test:rich-text
pnpm build
```

## 5. Apply the database changes

For a fresh environment, link the CLI to the intended project, inspect the target,
and review pending migrations. **Production has a manually managed history**:
the audit-safety and payment-fulfillment patches were separately approved/applied
on 2026-10-22. Do not replay all migrations or run a blind `db push` there. Reconcile
the recorded schema/history first and follow `PAYMENT_ROLLOUT.md` and
`ATTEMPT_ROLLOUT.md` for the coordinated release.

```bash
pnpm verify:production-target
pnpm exec supabase migration list
```

The final hardening migration keeps public content readable, hides correct
answers, scores submissions in the database, protects results with a random
per-session capability, and restricts administrative writes to Auth users with
an admin role.

## 6. Deploy Edge Functions

```bash
pnpm exec supabase functions deploy create-checkout --no-verify-jwt
pnpm exec supabase functions deploy verify-payment --no-verify-jwt
pnpm exec supabase functions deploy send-results-email --no-verify-jwt
pnpm exec supabase functions deploy stripe-webhook --no-verify-jwt
```

`create-checkout` and `verify-payment` are public endpoints with their own
session/payment checks. `send-results-email` additionally requires the private
worker secret or exact service-role authorization. `stripe-webhook` validates
Stripe's signature against the raw request body. Each index.ts starts its HTTP
server unconditionally; tests import handler.ts without starting a listener.
Follow `PAYMENT_ROLLOUT.md` for secrets, scheduler and test-mode acceptance.

Remove or disable legacy deployed functions that are not present in this
repository, especially unauthenticated Typeform/listing/webhook endpoints.

## 7. Deploy the frontend immediately

Configure only public frontend values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
VITE_RICH_TEXT_COMPATIBILITY_MODE=false
```

Push or merge the verified commit to `main`. The GitHub Pages workflow runs
frozen dependency installation, lint, both security regression suites, the
production build, and then publishes `dist/`. Watch the workflow to completion
before ending the maintenance window.

## Content-formatting rollback

The default renderer treats stored content as text and supports only the small
documented format (`**bold**`, bullet lines, paragraphs and separators). If
existing content loses important formatting, temporarily set
`VITE_RICH_TEXT_COMPATIBILITY_MODE=true` and rebuild. The compatibility path
allows only a small sanitized HTML allowlist; it never restores unrestricted
HTML. Use `RICH_TEXT_COMPATIBILITY_MODE=true` separately for result emails.

## Production smoke test

1. Confirm a public visitor can open and complete a test without registration.
2. Confirm the browser never receives `correct_answer`.
3. Confirm another browser cannot open a copied result URL without its fragment
   capability.
4. Confirm checkout uses the database price and paid verification unlocks only
   the matching session.
5. Confirm a non-admin Auth user cannot write content, while the configured
   administrator can.
6. Confirm the results email renders expected formatting and script/event
   attributes are removed.

## Storage recovery and idle operation

The frontend uploads question illustrations to the public `images` bucket in
production project `afsoyuczexiztsjntkvi`. Database tables and RLS policies alone
are insufficient: the bucket must exist too. A project being paused is a separate
condition from `StorageApiError: Bucket not found`.

After migration or recovery, apply
`supabase/migrations/20261022000000_restore_question_image_bucket.sql` and run
`supabase/tests/storage_readiness.sql` as the read-only readiness gate. The new
bucket accepts images up to 5 MiB. The migration is safe to repeat and preserves
existing buckets and policies. Never restore the legacy unrestricted upload
policy from the original January migration.

Verify a small image upload in the administrator UI, open its public URL, then
cancel the unsaved question edit. Also verify that an anonymous upload is denied.
Do not mark recovery complete based only on a working home page or table query.

Supabase Free can pause after insufficient database activity over seven days.
Pro removes automatic inactivity pausing; it does not replace backups or health
checks. On Free, an independent always-on scheduler can perform a small read of
public test metadata and check a known public Storage object every six hours, alerting on
failure. Never place service-role credentials in a public monitor.

Do not rely solely on GitHub Actions scheduled workflows for extended idle
periods: GitHub disables public-repository schedules after 60 days without
repository activity. Run production monitoring independently from that schedule
and from a developer laptop. Scheduled requests are not an uptime guarantee.

Maintain separate backups of database schema/data and Storage files. A database
backup does not include the stored object bytes. Verify both after recovery.

References:
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/platform/backups
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows

The selected free scheduler is the existing Cloudflare Worker
`supabase-read-health`, independent of GitHub, the developer laptop and the
Telegraph VPS. See [ops/scheduler/README.md](ops/scheduler/README.md) for the
deployment/cutover gates and actual status. The previous VPS timer is retired
only after a verified replacement check; historical evidence is retained.
