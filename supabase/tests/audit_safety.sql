\set ON_ERROR_STOP on
begin;
select count(*) as before_count from public.questions
where test_id = '11111111-1111-4111-8111-111111111111' \gset
set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
update public.tests set archived_at = now(), is_active = false
where id = '11111111-1111-4111-8111-111111111111';
select count(*) = :'before_count'::int as archive_kept_questions from public.questions
where test_id = '11111111-1111-4111-8111-111111111111' \gset
\if :archive_kept_questions
\else
  select 1/0;
\endif
reset role;
set local role anon;
select count(*) = 0 as archived_not_public from public.tests
where id = '11111111-1111-4111-8111-111111111111' \gset
\if :archived_not_public
\else
  select 1/0;
\endif
select count(*) = 1 as support_is_public from public.app_settings where key='support_contact' \gset
\if :support_is_public
\else
  select 1/0;
\endif
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{}}',true);
with changed as (update public.app_settings set value='not-authorized@example.test' where key='support_contact' returning 1)
select count(*) = 0 as non_admin_contact_write_blocked from changed \gset
\if :non_admin_contact_write_blocked
\else
  select 1/0;
\endif
reset role;
rollback;
\echo 'Audit safety SQL contracts passed'
