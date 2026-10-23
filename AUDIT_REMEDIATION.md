# Audit remediation — 2026-10-22

Working branch: `fix/audit-reliability`. A local passing check is not a production release.
The original 29-item technical audit remains the scope; unfinished items are listed below.
Authored meaning, marketing copy and result interpretations are preserved. Only unambiguous language errors may be fixed directly; semantic or technical-state wording changes require concrete proposals for user review.

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

`20261022200000_payment_fulfillment.sql` was subsequently explicitly approved and
executed in the same project. All seven read-only checks passed: both private
tables have RLS; anon/authenticated cannot read them or execute the seven private
RPCs; service_role can execute them; owned context is available; wrong capability
returns none; unpaid answers/scores remain hidden; no orders or mail jobs were
created by applying the patch. Matching Edge functions and worker/webhook setup
are still pending. Do not reapply this migration's CREATE statements.

On 2026-10-23 (Europe/Minsk), the user separately approved both
`20261022205025_pinned_test_attempts.sql` and
`20261022204510_normalize_image_bucket_limits.sql`. Both executed successfully.
Eight read-only access/configuration checks passed; tests/questions remain 2/21,
with zero attempt/version rows created by installation. The legacy submission
grant remains intentionally open until the new frontend is released. Recorded
hashes and results: `audit/production-attempt-schema-2026-10-23.json`.

`20261023073000_result_presentation.sql` was separately explicitly approved and
applied through the IQ Tests SQL editor on 2026-10-23 (Europe/Minsk). All nine
read-only installation/access/preservation checks passed; tests/questions/results
remain 2/21/6. Public HTTP confirms that the new presentation key is readable and
private admission limits remain hidden. Original stored email copy was retained.
The matched frontend and functions are still pending release. See
`audit/production-presentation-schema-2026-10-23.json`. Do not replay its named constraint.

## Status by audit item

| Item | Implemented / evidence | Still required |
|---|---|---|
| A01 timer/navigation race | Cancelled timer, index guard; browser rapid-click/navigation regression | Release |
| A02 unpaid score disclosure | Production RPC masks answers and scores; SQL capability/paid tests | Monitor with release |
| A03 discount/price changes | Immutable checkout order, canonical Stripe facts; Deno + PostgreSQL tests; payment migration applied | Deploy matching functions; Stripe test-mode round trip |
| A04 independent payment fulfillment | Signed webhook shares atomic fulfillment; concurrent SQL connections test | Configure endpoint/secret, verify live delivery and retries |
| A05 destructive test removal | Archive UI, restore flow, retained questions; browser + SQL tests | Frontend release |
| A06 result recovery | Explicit private-link copy, blocked-storage fallback, queued email contains recovery link | Deploy queue; independent email-based recovery flow still open |
| A07 false content/settings saves | Atomic upserts and surfaced failures; delayed content reads cannot replace a successful newer save, obsolete reads are cancelled and requests are bounded; browser tests | Release |
| A08 lost drafts | Expiring local drafts, pinned server attempt and restart UI; reload/ambiguous submission browser tests; schema applied | Frontend rollout |
| A09 missing error states | Question schema validation, retry screens, ErrorBoundary; bounded Home/result/payment requests; stale result, checkout and verification response regressions | Release |
| A10 admin validation | Price/options/correct answer/number validation, save locks and errors; image format/signature/decode/size/dimensions validated | Broader validation coverage and release |
| A11 changing slug | Existing slug retained on title change; browser test | Release |
| A12 live question mutation | Private immutable question/scoring/price versions; archive resume; SQL + browser tests, concurrent submission test; migration applied; real preview started/resumed the attempt and loaded all 21 questions | Release frontend; finish approved production submission smoke test |
| A13 email failures | Durable leased outbox, bounded retries, immutable provider payload, localized email preserving authored interpretations and stored archetype copy; Deno + SQL tests | Private scheduler/secret, failure monitoring, real provider test |
| A14 score interpretation | Original score thresholds and single-leader descriptions preserved; user-approved default state messages; admin-controlled mixed/priority ties, zero fallback and bilingual messages; shared selection for result/archetype/email, preview, atomic saves and failure recovery | Presentation migration applied; deploy matching functions/frontend; editorial reinterpretation remains excluded without approval |
| A15 tracking consent | No eager tracking, explicit allow/decline/revoke; browser network test; Inter now self-hosted | Release |
| A16 banner overlap | Consent in document flow; mobile browser test | Release |
| A17 mobile entry | First-screen CTA/price, wider vertical card; mobile browser test | Release; broader device review |
| A18 image questions | Native zoom dialog, load error/retry; browser modal/retry/Escape test passed | Release |
| A19 accessibility | Named controls, headings/landmarks, native password dialog, keyboard focus recovery; 17 screen states pass axe 4.14.0 without exclusions, including bilingual payment previews; language button names include visible RU/EN; compact confirmation controls retained | Manual gradient contrast, screen-reader and broader device review; release |
| A20 monitoring | Updated existing VPS 6h read-only monitor: database, homepage, static image, public Storage listing and bounded object sample; empty bucket explicitly skips download; offline 8h freshness check; all 12 scenarios pass locally and on VPS, first live run passed | External watchdog and chosen alert channel; stored-object download cannot be exercised while bucket is empty; upload permissions checked separately |
| A21 backups | Read-only PostgreSQL/Storage exporter, age encryption, safe verified extraction, weekly service template; 11 tests including real PostgreSQL 17 restore and fixture Storage bytes | Operator-owned keys/credentials, first live encrypted off-site copy and isolated hosted Auth/Storage restore drill; retention/staleness alerts |
| A22 schema/CI | Baseline, clean real PostgreSQL migration/RLS/scoring checks, browser/Edge deployment gates; full PR CI passed for a4c468b with 44 browser tests; maintained Actions and Pages artifact build passed, review-branch deploy was skipped; removed duplicate push/PR validation starts | Reconcile live migration history |
| A23 dependency advisories | Compatible dependency updates, DOMPurify 3.4.17; pnpm audit reports zero advisories; maintained Node 24 Actions pinned to release commit SHAs, stable Ubuntu image and build-only review-branch runs | Release; track deprecated ESLint 9 separately |
| A24 anonymous abuse | Private attempt capability, bounded snapshot/answer sizes, UTC admission quotas, shared versions, abandoned-attempt cleanup; real anon/auth and concurrent SQL checks; schema applied | Frontend rollout and explicit legacy RPC cutover; monitor quota exhaustion; stronger bot controls remain open |
| A25 security headers/logging | Capability log removed; no-store responses; sanitized logs; CSP/HSTS/frame/referrer headers verified on actual Cloudflare preview; Pages write/OIDC permissions limited to main-only deployment job, checkout does not persist credentials | Coordinate production hosting rollout |
| A26 routes/metadata | Route titles, canonical/noindex; Cloudflare preview direct /privacy returns HTTP 200 and renders app under CSP | Live domain still uses GitHub Pages and returns 404 on direct routes; hosting rollout |
| A27 duplicate analytics | Consent-gated purchase, SHA-256 transaction ID; concurrent callbacks deduplicate even with blocked storage; broken providers cannot block checkout/answers; browser tests | Release |
| A28 locale/support/demo | Public support configurable in admin; late reads cannot replace newer saved contacts; unsaved follow-up selections survive language changes; English mode survives blocked preference storage; settings label translated; preview gated by administrator auth; actual payment pages now read/save canonical per-language content keys, independently tested through reload and mid-edit language switch | Source-question translations require separate user review; release |
| A29 upload/orphan quota | Format/signature/decode/size/dimension validation; cancel cleans only editor-owned uploads; saved/ambiguous writes preserved; 5 browser tests passed; upload limits applied | Release frontend; reference-aware GC review for old orphans |

## Validation already exercised

- Settings-state follow-up: both late support-contact replacement and lost follow-up draft on language switch were reproduced before the fix. The fixes preserve successful writes and unsaved selections; failed target loads cannot save an empty fallback. All 27 affected browser scenarios passed, followed by three final targeted regressions after the PromiseLike typing/editor-lock correction; lint/build/security/rich-text/hosting passed. No production writes were needed for these tests. See `audit/settings-state-races-2026-10-23.json`.

- Administrator presentation controls: agreed state messages are defaults; mixed/priority tie selection and explicit zero fallback are editable with preview, bilingual text and staged default reset. All 20 affected browser scenarios passed, including an expanded-form axe check without exclusions; all 13 Edge tests and real PostgreSQL 17 migration/RLS/size/worker/backup contracts passed. Invalid/unavailable rules prevent guessed profile delivery. The initial full browser run passed 51/53; two new tests needed role-based locators for nested labels, then bilingual mode enabled in the bilingual fixture. See `ADMIN_RESULT_RULES.md` and `audit/admin-presentation-2026-10-23.json`. The new production migration was subsequently approved, applied and verified; all matching frontend/functions still await deployment. Full Linux CI for `af16cf3` passed all 53 browser tests, 13 Edge tests and all SQL/security/build gates ([39918144002](https://github.com/stripeiqtests/stripeiqtests.github.io/actions/runs/39918144002)).

- Content-load race reproduced before the fix: a held initial response replaced a successful edit with its old snapshot. The regression now preserves the new saved key while accepting unrelated server content. All 22 affected reliability/payment-editor/accessibility scenarios passed; after the cancellation compatibility/lint follow-up, both content regressions passed again, lint was clean and the production build passed. No production content writes were used.
- Full Linux CI passed for authored-copy restoration `8678f1c`, including 49 browser tests, 10 Edge tests, PostgreSQL/backup, monitoring, security and build gates ([39914254956](https://github.com/stripeiqtests/stripeiqtests.github.io/actions/runs/39914254956)).

- Authored-copy restoration: original homepage metadata/defaults, 16 result interpretation/profile strings and authored email content restored; stored archetypes are escaped and frozen with the provider payload. All 49 browser tests, 10 Edge tests, Edge typechecks/bundles, lint/build/security/rich-text and hosting checks passed locally. No main/frontend/Edge deployment or production stored-copy update occurred. Earlier evidence describing neutral/factual reinterpretations is superseded by `audit/authored-copy-restoration-2026-10-23.json`; `COPY_REVIEW.md` separates proposed technical-state wording for user review.

- Payment-localization follow-up: the full local browser suite passed all 48 tests; a subsequent expanded bilingual accessibility check exposed the RU/EN visible-label mismatch, which was corrected without disabling rules. All 13 affected localization/accessibility scenarios then passed. The two added preview states bring axe coverage to 17 states. See `audit/payment-localization-2026-10-23.json`; all payment requests use fixtures.
- `a4c468b` passed full Linux CI ([39908855254](https://github.com/stripeiqtests/stripeiqtests.github.io/actions/runs/39908855254)). A manual Pages build on the review branch also passed, including the new artifact action; the publishing job was skipped by the main-only guard ([39908852121](https://github.com/stripeiqtests/stripeiqtests.github.io/actions/runs/39908852121)). No production frontend publication occurred.
- Updated the existing VPS monitor after tests/checksums, preserving previous script/unit files for recovery. First systemd run and offline freshness check succeeded at 06:13 UTC on 2026-10-23. Bucket `images` was empty, so the report explicitly skipped stored-object download. No upload, result creation, email or payment was initiated. See `audit/monitoring-2026-10-23.json`.
- `pnpm test:database` now also exercises a real age-encrypted backup/restore: archived/active tests, questions, protected results, private orders/mail, pinned attempts, Storage metadata, policies and critical grants match the source. All 11 backup scenarios passed, including wrong key, tampering/truncation, unsafe archives, Storage failure/change/pagination, low disk and redirect refusal. Storage HTTP remains a fixture; no live backup or hosted-service restoration is claimed. See `BACKUP_RECOVERY.md` and `audit/backup-tooling-2026-10-23.json`.
- `pnpm test:browser`: all 43 tests passed, including pinned attempts/lost submission response, stale payment/result requests, preview authorization, locale, analytics and upload cleanup. 15 screen states had zero detected axe violations without rule/selector exclusions; incomplete gradient-contrast checks remain a manual review item. See `audit/accessibility-and-payment-ui-2026-10-23.json`.
- A subsequent successful-payment fixture confirms protected-result navigation, the actual discounted amount in analytics and no duplicate purchase on a repeated return-page visit; all 12 affected payment/accessibility tests passed after adding it.
- Full Linux CI subsequently passed for `61e8678`: all 44 browser tests, PostgreSQL concurrency/grants, Edge, lint and production build. The small contrast follow-up passed all 7 accessibility scenarios locally.
- `pnpm lint`, `pnpm build`, `pnpm test:security`, `pnpm test:rich-text`, `pnpm test:hosting`: passed for this revision.
- `deno check --config supabase/functions/deno.json` for all four payment/worker entry points passed.
- `pnpm test:edge`: all 9 tests passed, including expired checkout recovery. No real payments/emails/network destinations used.
- `pnpm test:database`: clean migrations, RLS/scoring/archive and payment/outbox contracts passed;
  two PostgreSQL connections raced the same payment: one first fulfillment, one idempotent repeat, one email job.
- Two additional connections submitted one admitted attempt concurrently: exactly one result; real anon/authenticated RPC calls, abandoned-attempt retention and the explicit legacy cutover also passed.
- Read-only live preflight reported PostgreSQL 17.6; the same full database suite subsequently passed on PostgreSQL 17 as well as 15. The runner now defaults to the production major.
- The Docker fixture models SQL platform schemas; it does not replace a full Supabase HTTP or real Stripe/Resend integration test.
- The real branch preview called the production attempt API, loaded all 21 questions, and restored an answer/current question after reload. Final result creation was stopped by automatic approval review, pending explicit permission to write one production QA result; no payment/email was initiated.

## Payment rollout boundary

See `PAYMENT_ROLLOUT.md`. The payment migration is applied; matching Edge code,
webhook/worker setup and frontend release remain pending. They require a reviewed
coordinated rollout and test-mode integration evidence.
Free-tier keep-alive reduces pause risk; it cannot guarantee a free project remains active.

`ATTEMPT_ROLLOUT.md` describes the applied pinned-attempt migration and the
separate post-frontend legacy RPC cutover. Only the latter is still pending.
Image-limit normalization is also applied. Browser/Data API acceptance remains
distinct from the successful schema/access checks.

## Existing Cloudflare preview

GitHub's existing Cloudflare Pages integration produced a separate branch preview
for commit `771d52c`; it served the actual app at `/privacy` with HTTP 200. The live
`inner-code.me/privacy` still returned HTTP 404 from GitHub Pages. This is evidence
of an available preview host, not a DNS migration or production release.
The next hosting artifact adds CSP/HSTS/referrer/frame headers and uses Cloudflare's
documented SPA fallback while retaining GitHub's redirect fallback in its own build.
Preview `8bc006b7.inner-code-iq-test.pages.dev/privacy` was subsequently verified:
HTTP 200; CSP with the correct inline-script hash, HSTS, no-referrer, SAMEORIGIN
and noindex headers; the real app rendered and navigated home with no console
errors/warnings in this read-only browser check. Production DNS has not changed.

## Accessibility follow-up

The browser suite uses the official `@axe-core/playwright` integration described
in [Playwright's accessibility guide](https://playwright.dev/docs/accessibility-testing).
No rules or selectors are excluded. Findings were fixed in the UI: labels,
landmarks/headings, contrast, nested interactive paywall controls and keyboard
focus after cancelling an inline edit. Tests also cover the administrator-only
preview and changing preview routes. The unchanged compact confirmation layout
is absolutely positioned, with reserved text padding and explicit dark editor text.
Automated results supplement keyboard checks; they do not establish full WCAG
conformance or replace the open manual gradient/screen-reader/device review.
