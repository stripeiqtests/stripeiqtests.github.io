\set ON_ERROR_STOP on

begin;

select id as test_id
from public.tests
where is_active = true
order by created_at
limit 1
\gset

select jsonb_object_agg(id::text, correct_answer)::text as answers
from public.questions
where test_id = :'test_id'::uuid
\gset

select (
  not has_table_privilege('anon', 'public.test_sessions', 'select')
  and not has_column_privilege('anon', 'public.questions', 'correct_answer', 'select')
) as direct_sensitive_reads_blocked
\gset

\if :direct_sensitive_reads_blocked
\else
  \echo 'sensitive table/answer read privilege is exposed'
  select 1 / 0;
\endif

set local role anon;

select session_id, access_token
from public.submit_test_session(:'test_id'::uuid, null, :'answers'::jsonb)
\gset

select (
  count(*) = 1
  and min(overall_score) = 100
) as owner_can_read_authoritative_score
from public.get_test_session(:'session_id'::uuid, :'access_token'::uuid)
\gset

\if :owner_can_read_authoritative_score
\else
  \echo 'server-side scoring or capability-authorized read failed'
  select 1 / 0;
\endif

select count(*) = 0 as wrong_capability_blocked
from public.get_test_session(
  :'session_id'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid
)
\gset

\if :wrong_capability_blocked
\else
  \echo 'wrong result capability was accepted'
  select 1 / 0;
\endif

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{}}', true);

with changed as (
  update public.app_settings
  set value = value
  where key = 'language_mode'
  returning 1
)
select count(*) = 0 as non_admin_write_blocked from changed
\gset

\if :non_admin_write_blocked
\else
  \echo 'non-admin authenticated write was accepted'
  select 1 / 0;
\endif

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"role":"admin"}}',
  true
);

with changed as (
  update public.app_settings
  set value = value
  where key = 'language_mode'
  returning 1
)
select count(*) = 1 as admin_write_allowed from changed
\gset

\if :admin_write_allowed
\else
  \echo 'admin JWT write was rejected'
  select 1 / 0;
\endif

reset role;
rollback;

\echo 'security RLS regression checks passed'
