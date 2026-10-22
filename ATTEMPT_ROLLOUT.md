# Pinned attempts release

Prepared and tested locally. These changes are not applied to production.
Target: IQ Tests / `afsoyuczexiztsjntkvi` only. Never replay the entire migration
directory against its manually managed schema.

## Behavior

`start_test_attempt(slug, random_uuid)` returns one fixed question/test snapshot,
without correct answers. The private token is stored in the same browser as its
draft. A reload resumes that version for seven days, including after test archive.
A deliberate restart requests the current version. Correct answers, scoring
algorithm, title and price are frozen server-side; submissions cannot choose a
version or send their own score. Old results without a version keep their former
compatibility path.

`submit_test_attempt` locks the admitted attempt. Retries and simultaneous requests
return its original protected session; changed retry email/answers cannot overwrite
it. Checkout and result context read the fixed metadata. The result capability is
separate from the attempt token. Public table access to versions/attempts is denied.

## Free-tier resource controls and limits

The private `attempt_hourly_limit` (default 100) and `attempt_daily_limit` (500)
settings bound admission globally in UTC. Retrying an already admitted attempt does
not consume that quota. No browser-controlled IP/header is trusted as identity.
Snapshots are shared by content hash; question count/JSON size and answer size are
bounded. New admissions remove up to 100 expired, unsubmitted attempts and up to
100 unreferenced versions. Submitted results and their versions are retained.

These are storage circuit breakers, not complete bot protection. An attacker can
exhaust the global quota, temporarily blocking new attempts; existing attempts
still work. Monitor and tune limits for real traffic before promoting the release.
Network/provider limits and a future server-verified challenge may be useful;
do not claim per-person rate limiting or unlimited free-tier capacity.

## Coordinated rollout

1. Pass lint, build, browser, Edge and PostgreSQL gates. Back up the live schema/data.
2. Review/apply only `20261022205025_pinned_test_attempts.sql` after the already
   applied audit/payment patches. It adds private tables and a nullable version
   column; it preserves existing results/questions. Apply the separate image
   limits patch when releasing the validated upload UI.
3. Deploy/verify the matching payment functions and frontend. Follow
   `PAYMENT_ROLLOUT.md` for webhook and email worker acceptance.
4. Verify through the real Data API: anonymous start hides correct answers;
   complete a fixture, repeat its submission and get the same session; wrong
   capability cannot read it; an unpaid result has no scores. In a non-production
   fixture verify question/price edits and archive do not mutate an admitted test.
5. Only after that frontend works, apply the explicit release operation
   `supabase/operations/retire_legacy_submission.sql`. The old public
   `submit_test_session` would otherwise bypass admission limits and pinning.
   Re-run its grant check plus new anonymous submission. The database suite
   exercises this same operation and verifies both boundaries.

Until step 5, do not report the anonymous abuse bypass as closed. Old open tabs
using the former frontend need a refresh after cutover; retain the old function
body for controlled incident recovery, without restoring public execution as a
routine rollback. Do not roll back score masking or delete paid results.

If either local storage write fails, the UI warns that reload recovery is
unavailable; the current tab can still complete. Existing pre-release local drafts
are not silently applied to a different server attempt/version. Never log attempt
or result tokens, emails, answers, or private recovery URLs.
