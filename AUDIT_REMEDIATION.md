# Audit remediation — 2026-10-22

Working branch: `fix/audit-reliability`. A local passing check is not a production release.
The original 29-item audit remains the scope; unfinished items are listed below.

## Production changes confirmed

`20261022190000_audit_safety.sql` was explicitly approved and executed through the
SQL editor of **IQ Tests / afsoyuczexiztsjntkvi** on 2026-10-22. The editor returned
`Success. No rows returned`. Read-only checks confirmed the archive column and
constraint, public support contact/policy, and hidden unpaid answers/all five scores.
No paid sessions existed in this project at verification time; the paid branch was
verified using isolated PostgreSQL fixtures, not claimed as exercised on live data.
Questions, sessions and Storage files were not deleted by this patch.

Do not reapply the patch blindly: its named constraint already exists in production.
The dashboard's old manually managed migration history must be reconciled before
using `supabase db push`; do not replay the whole migration directory against live.

## Status by audit item

| Item | Implemented / evidence | Still required |
|---|---|---|
| A01 timer/navigation race | Cancelled timer, index guard; browser rapid-click/navigation regression | Release |
| A02 unpaid score disclosure | Production RPC masks answers and scores; SQL capability/paid tests | Monitor with release |
| A03 discount/price changes | Immutable checkout order, canonical Stripe facts; Deno + PostgreSQL tests | Deploy payment migration/functions; Stripe test-mode round trip |
| A04 independent payment fulfillment | Signed webhook shares atomic fulfillment; concurrent SQL connections test | Configure endpoint/secret, verify live delivery and retries |
| A05 destructive test removal | Archive UI, restore flow, retained questions; browser + SQL tests | Frontend release |
| A06 result recovery | Explicit private-link copy, blocked-storage fallback, queued email contains recovery link | Deploy queue; independent email-based recovery flow still open |
| A07 false content/settings saves | Atomic upserts and surfaced failures; browser tests | Release |
| A08 lost drafts | Expiring local drafts and restart UI; browser test | Server-side submission idempotency |
| A09 missing error states | Question schema validation, retry screens, ErrorBoundary; Home distinguishes failed/empty list and bounds fetch time; result retry/storage tests | Complete stale Results/network race coverage |
| A10 admin validation | Price/options/correct answer/number validation, save locks and errors | Broader validation tests; image validation |
| A11 changing slug | Existing slug retained on title change; browser test | Release |
| A12 live question mutation | Not implemented | Pin attempt question/scoring version |
| A13 email failures | Durable leased outbox, bounded retries, immutable provider payload, localized factual email; Deno + SQL tests | Private scheduler/secret, failure monitoring, real provider test |
| A14 score interpretation | Neutral percentage wording, ties/zero handled; result helper tests; email fixed | Release; review editable legacy copy |
| A15 tracking consent | No eager tracking, explicit allow/decline/revoke; browser network test; Inter now self-hosted | Release |
| A16 banner overlap | Consent in document flow; mobile browser test | Release |
| A17 mobile entry | First-screen CTA/price, wider vertical card; mobile browser test | Release; broader device review |
| A18 image questions | Native zoom dialog, load error/retry; browser modal/retry/Escape test passed | Release |
| A19 accessibility | Language attribute, option/progress semantics, focus and contrast fixes | Full keyboard and contrast review |
| A20 monitoring | Existing free 6h read-only check remains | Storage/database coverage, staleness, chosen alert channel |
| A21 backups | Not implemented | Encrypted DB + Storage backup and restore drill |
| A22 schema/CI | Baseline, clean real PostgreSQL migration/RLS/scoring checks, browser/Edge deployment gates, PR validation workflow | Reconcile live migration history; confirm remote CI |
| A23 dependency advisories | Compatible dependency updates, DOMPurify 3.4.17; pnpm audit reports zero advisories; build/browser checks passed | Release; track deprecated ESLint 9 separately |
| A24 anonymous abuse | Payment calls have private capability checks and idempotent order/fulfillment | Public attempt/submission rate limits and idempotency |
| A25 security headers/logging | Capability console log removed; payment responses no-store; sanitized server error logs; Cloudflare header artifact with hashed inline helper | Verify CSP on preview and coordinate production hosting rollout |
| A26 routes/metadata | Public/private route titles, canonical/noindex metadata; host-aware Cloudflare SPA fallback artifact | Preview headers/routes verification; live domain still uses GitHub Pages and returns 404 on direct routes |
| A27 duplicate analytics | Consent-gated purchase, stable SHA-256 transaction identifier | Result/payment browser scenarios, release |
| A28 locale/support/demo | Public support configurable in admin; locale-preserving payment email; admin preview gated | Remaining missing translations and source question language |
| A29 upload/orphan quota | Not implemented | Upload validation, safe cleanup, normalized bucket limits |

## Validation already exercised

- `pnpm test:browser`: 16 tests passed after compatible dependency updates; metadata and Home-failure cases added and exercised in a focused 11-test run.
- `pnpm lint`, `pnpm build`, `pnpm test:security`, `pnpm test:rich-text`: passed at earlier checkpoints.
- `deno check --config supabase/functions/deno.json` for all four payment/worker entry points passed.
- `pnpm test:edge`: all 9 tests passed, including expired checkout recovery. No real payments/emails/network destinations used.
- `pnpm test:database`: clean migrations, RLS/scoring/archive and payment/outbox contracts passed;
  two PostgreSQL connections raced the same payment: one first fulfillment, one idempotent repeat, one email job.
- The Docker fixture models SQL platform schemas; it does not replace a full Supabase HTTP or real Stripe/Resend integration test.

## Payment rollout boundary

See `PAYMENT_ROLLOUT.md`. The new payment migration and Edge code are **not deployed**.
They require a reviewed coordinated rollout and test-mode integration evidence.
Free-tier keep-alive reduces pause risk; it cannot guarantee a free project remains active.

## Existing Cloudflare preview

GitHub's existing Cloudflare Pages integration produced a separate branch preview
for commit `771d52c`; it served the actual app at `/privacy` with HTTP 200. The live
`inner-code.me/privacy` still returned HTTP 404 from GitHub Pages. This is evidence
of an available preview host, not a DNS migration or production release.
The next hosting artifact adds CSP/HSTS/referrer/frame headers and uses Cloudflare's
documented SPA fallback while retaining GitHub's redirect fallback in its own build.
Its deployment still needs preview verification before any domain change.
