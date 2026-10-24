\set ON_ERROR_STOP on
begin;
select jsonb_object_agg(id::text,correct_answer)::text as answers from public.questions
where test_id='11111111-1111-4111-8111-111111111111' \gset
set local role anon;
do $$begin
  begin
    perform public.submit_test_session('11111111-1111-4111-8111-111111111111',null,'{}');
    raise exception 'Legacy bypass still callable';
  exception when insufficient_privilege then null;end;
end $$;
select public.start_test_attempt('sql-fixture','99999999-9999-4999-8999-999999999999');
select session_id,access_token from public.submit_test_attempt('99999999-9999-4999-8999-999999999999',null,:'answers'::jsonb) \gset
select count(*)=1 and count(overall_score)=0 as private_result
from public.get_test_session(:'session_id'::uuid,:'access_token'::uuid) \gset
\if :private_result
\else
  select 1/0;
\endif
reset role;
rollback;
\echo 'Release cutover denies legacy submission while the anonymous pinned API remains usable'
