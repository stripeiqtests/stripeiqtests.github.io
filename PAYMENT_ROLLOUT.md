# Payment fulfillment rollout

This is a reviewable release procedure, not evidence that deployment happened.
The database migration was explicitly approved and applied on 2026-10-22; its
seven read-only production checks passed. The private `result-email-worker` was deployed on 2026-10-23 with a dedicated
secret and a successful scheduled read-only readiness check. The user then
explicitly approved automatic queued dispatch. Cloudflare `outbox-v1` is enabled;
a real scheduled run passed at 10:00:13 UTC with processed=0/sent=0. Provider
acceptance/inbox delivery remain untested because the queue was empty. `verify-payment` version 13 is deployed: it
commits paid access/outbox without waiting for the provider and preserves
already-paid legacy results without re-enqueueing historical mail. Remaining
payment functions, Stripe webhook setup and frontend release are tracked separately.
Target: `afsoyuczexiztsjntkvi` only. A shared Windows CLI credential changed
identity during the rollout; its attempt to update verification correctly failed
with 403 for the fixed IQ ref. Use an isolated operator-approved Supabase home
and assert project membership before each mutation. See `ops/scheduler/README.md`.

## Package

1. `20261022200000_payment_fulfillment.sql`: private immutable checkout orders,
   atomic entitlement + email enqueue, leased retry outbox, capability-protected
   result context (also works after test archival).
2. Updated `create-checkout`, `verify-payment`, private `result-email-worker`,
   the future `send-results-email` compatibility alias and `stripe-webhook`, with shared modules and the committed Deno dependency lock.
3. Matching frontend: sends locale, displays actual email queue state and reads
   result metadata through the capability-protected context endpoint.

For the dashboard's single-file editor, `pnpm bundle:edge` bundles local shared
modules into five readable candidates under `node_modules/.tmp/edge-bundles/`.
`manifest.json` records the exact target, file hashes and JWT setting; it does not
deploy anything or contain secret values. The external Stripe npm import stays
version-pinned. Prefer normal multifile CLI/MCP deployment once the correct
account is connected; if using the editor, compare the entire pasted file with
the candidate before deploying. Retain the preceding deployed source for recovery.

No existing results/questions are deleted. Existing Checkout sessions created by
the prior server remain supported through their Stripe-stored `expectedAmount`
metadata; current editable test prices are not used to reject those payments.

## Required configuration

- Retain existing `STRIPE_SECRET_KEY`, database service key, `RESEND_API_KEY`.
- Set `STRIPE_WEBHOOK_SECRET` for this exact endpoint/account/mode.
- Set a separately generated `RESULT_EMAIL_WORKER_SECRET`, used only to drain the
  mail queue. It does not authorize arbitrary emails, SQL, result reads or payments.
- Create the Stripe endpoint at
  `https://afsoyuczexiztsjntkvi.supabase.co/functions/v1/stripe-webhook`, subscribed
  to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Use the existing Cloudflare Worker `supabase-read-health` to invoke the private
  email worker every two minutes, POST `{}` with its narrow Bearer secret.
  This is a release gate for both payment paths: verification and the webhook
  commit paid access + outbox and return without contacting the mail provider.
  Store it as an encrypted Cloudflare Worker secret, never in the repository or
  the public health check. No VPS or systemd service is needed. Follow
  `ops/scheduler/README.md`; `MAIL_ENABLED=outbox-v1` is now explicitly approved,
  deployed and verified by a real scheduled empty-queue run. `preflight-v1`
  remains available for protected readiness reads without claims/sends.
  The monitor/notification destination is not chosen yet; do not send messages.
- Never paste real secret values into chat, source, shell history or screenshots.
  Credential entry/creation in the browser is a user handoff when required.

Live preflight found existing names `STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
a legacy `SERVICE_KEY ` name (with a trailing space) and `STRIPE_WEBHOOK_SECRET`.
The new code uses the built-in service-role fallback. Values were not revealed. A
stored webhook secret name does not verify the Stripe endpoint/account/mode;
inspect that endpoint and signed delivery before treating it as configured.

## Release order and acceptance

1. Run lint/build/browser/Edge/real PostgreSQL gates. Review SQL grants and diffs.
2. Database step completed with explicit approval. Do not repeat its CREATE
   statements or replay historical migrations against the manually managed database.
3. Deploy shared modules and all matching functions to the verified target.
4. Configure webhook and private retry worker. Use a test-mode isolated environment
   to exercise success, promo discount, 100% promo, price change after checkout,
   closed return tab, duplicate webhook, expired checkout, and temporary mail error.
   Real financial transactions must be completed by the user when required.
5. Release frontend and verify a paid capability can retrieve its archived test
   metadata; an unpaid capability cannot read scores; wrong capability returns none.
6. Verify Stripe delivery succeeds, no duplicate entitlement/mail jobs, pending mail
   transitions to sent or a visible failure, and the personalized email link opens
   results in a fresh browser session. Verify provider acceptance separately from
   actual inbox delivery; the UI does not promise delivery.

## Failure behavior and recovery

- Database failure: webhook returns 503 for Stripe retry; no premature 200 success.
- Email failure: paid access remains unlocked; persistent pending job retries.
  The return-page handler does not wait for the mail provider, so a stalled
  delivery cannot consume the browser verification timeout.
- Worker crash: lease expires in 2 minutes. Provider requests use one frozen body
  and an idempotency key per job. Resend keys last 24h; automatic retries stop at
  8 attempts or before 23h. Old ambiguous sends require operator review.
- Do not claim exactly-once email delivery beyond the provider's idempotency window.
- Do not roll back the live score-masking patch. If payment release fails, retain
  private order/outbox records for reconciliation; do not drop paid state/tables.
- Reverting to the former verification code reintroduces discount/price-change
  failures. Prefer fixing the new shared fulfillment path and replaying failed
  signed Stripe deliveries after recovery.

Official references: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment),
[Stripe webhook verification](https://docs.stripe.com/events/manage-webhook-endpoints),
[Resend idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Administrator presentation rules

The follow-up `20261023073000_result_presentation.sql` was separately approved, applied and verified in IQ Tests on 2026-10-23; all nine SQL checks passed and counts remain 2 tests / 21 questions / 6 results.
It exposes only the public presentation configuration, keeps existing saved email
copy, and grants the worker read access to authored archetypes. Its named constraint is already installed; do not replay it. Deploy the matching email/frontend candidates separately. See
`ADMIN_RESULT_RULES.md` for current-result versus frozen-email behavior and defaults.
