\set ON_ERROR_STOP on
begin;
create temporary table attempt_fixture(token uuid, snapshot jsonb, answers jsonb, session_id uuid, access_token uuid);
insert into attempt_fixture(token,answers) select '66666666-6666-4666-8666-666666666666',jsonb_object_agg(id::text,correct_answer)
  from public.questions where test_id='11111111-1111-4111-8111-111111111111';
-- Match the legacy JSON-string representation written by the former admin UI.
update public.questions set options=to_jsonb(options::text) where test_id='11111111-1111-4111-8111-111111111111';
update attempt_fixture set snapshot=public.start_test_attempt('sql-fixture',token);
do $$
declare f record;b jsonb;r record;o jsonb;
begin
  select * into f from attempt_fixture;
  if jsonb_path_exists(f.snapshot,'$.questions[*].correct_answer') then raise exception 'Correct answers leaked'; end if;
  if jsonb_typeof(f.snapshot->'questions'->0->'options')<>'array' then raise exception 'Legacy options not normalized'; end if;
  if has_table_privilege('anon','public.test_versions','select') or has_table_privilege('authenticated','public.test_attempts','select') then raise exception 'Snapshot/capability table exposed'; end if;
  update public.questions set correct_answer='B',question_text='Changed after start' where test_id='11111111-1111-4111-8111-111111111111';
  update public.tests set title='Changed title',price_cents=999,is_active=false,archived_at=now() where id='11111111-1111-4111-8111-111111111111';
  b:=public.start_test_attempt('sql-fixture',f.token);
  if b is distinct from f.snapshot then raise exception 'Existing attempt snapshot mutated'; end if;
  begin
    perform public.start_test_attempt('sql-fixture',gen_random_uuid());raise exception 'New attempt on archived test accepted';
  exception when sqlstate 'P0002' then null;end;
  begin
    perform public.submit_test_attempt(f.token,null,'{}');raise exception 'Missing answers accepted';
  exception when raise_exception then if sqlerrm='Missing answers accepted' then raise;end if;end;
  begin
    perform public.submit_test_attempt(f.token,null,jsonb_set(f.answers,array[(select key from jsonb_each(f.answers) limit 1)],'"unknown-label"'));
    raise exception 'Invalid option accepted';
  exception when raise_exception then if sqlerrm='Invalid option accepted' then raise;end if;end;
  select * into r from public.submit_test_attempt(f.token,'fixture@example.test',f.answers);
  update attempt_fixture set session_id=r.session_id,access_token=r.access_token;
  if (select overall_score from public.test_sessions where id=r.session_id)<>100 then raise exception 'Scored changed answers instead of snapshot';end if;
  if (select overall_score from public.get_test_session(r.session_id,r.access_token)) is not null then raise exception 'Snapshot leaked unpaid score';end if;
  o:=public.prepare_checkout(r.session_id,r.access_token,'ru','https://inner-code.me');
  if (o->>'expected_amount')::int<>200 or o->>'title'<>'Isolated SQL fixture' then raise exception 'Checkout ignored attempt snapshot';end if;
  if (select (test->>'price_cents')::int from public.get_result_context(r.session_id,r.access_token))<>200 then raise exception 'Result ignored version price';end if;
  select * into r from public.submit_test_attempt(f.token,'changed@example.test','{}');
  if r.session_id<>(select session_id from attempt_fixture) or r.access_token<>(select access_token from attempt_fixture) then raise exception 'Duplicate submit created a new result';end if;
  if (select email from public.test_sessions where id=r.session_id)<>'fixture@example.test' then raise exception 'Retry overwrote result';end if;
  begin
    perform public.submit_test_attempt(gen_random_uuid(),null,f.answers);raise exception 'Wrong capability accepted';
  exception when sqlstate 'P0002' then null;end;
end $$;
-- Limit is a global quota, independent of spoofable client headers or a new UUID.
update public.tests set is_active=true,archived_at=null where id='11111111-1111-4111-8111-111111111111';
update public.app_settings set value='1' where key='attempt_hourly_limit';
do $$begin
  begin
    perform public.start_test_attempt('sql-fixture',gen_random_uuid());raise exception 'Admission quota bypassed';
  exception when sqlstate '54000' then null;end;
  perform public.start_test_attempt('sql-fixture',(select token from attempt_fixture));
end $$;
-- Execute the actual API boundary under both browser roles, not just the owner.
update public.app_settings set value='100' where key='attempt_hourly_limit';
do $$declare abandoned uuid;completed uuid;begin
  select result_session_id into completed from public.test_attempts where result_session_id is not null limit 1;
  update public.test_attempts set expires_at=now()-interval '1 day' where result_session_id=completed;
  insert into public.test_attempts(token_hash,version_id,expires_at)
    select sha256(convert_to('expired-fixture','utf8')),version_id,now()-interval '1 day'
    from public.test_attempts where result_session_id=completed returning id into abandoned;
  perform public.start_test_attempt('sql-fixture','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if exists(select 1 from public.test_attempts where id=abandoned) then raise exception 'Abandoned expired token not pruned';end if;
  if not exists(select 1 from public.test_attempts where result_session_id=completed)
    or not exists(select 1 from public.test_sessions where id=completed) then raise exception 'Retention deleted a completed result';end if;
end $$;
grant select,update on attempt_fixture to anon,authenticated;
set local role anon;
update attempt_fixture set token='77777777-7777-4777-8777-777777777777',snapshot=public.start_test_attempt('sql-fixture','77777777-7777-4777-8777-777777777777');
do $$declare f record;r record;begin
  select * into f from attempt_fixture;
  if jsonb_path_exists(f.snapshot,'$.questions[*].correct_answer') then raise exception 'Anon snapshot exposed answers';end if;
  select * into r from public.submit_test_attempt(f.token,null,f.answers);
  update attempt_fixture set session_id=r.session_id,access_token=r.access_token;
  if r.session_id is null or r.access_token is null then raise exception 'Anon submit failed';end if;
  if (select overall_score from public.get_test_session(r.session_id,r.access_token)) is not null then raise exception 'Anon unpaid score exposed';end if;
  begin
    perform 1 from public.test_versions;raise exception 'Anon private version read accepted';
  exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$declare f record;r record;begin
  select * into f from attempt_fixture;
  perform public.start_test_attempt('sql-fixture',f.token);
  select * into r from public.submit_test_attempt(f.token,'retry@example.test','{}');
  if r.session_id<>f.session_id or r.access_token<>f.access_token then raise exception 'Authenticated retry changed result';end if;
  begin
    perform 1 from public.test_attempts;raise exception 'Authenticated private capability read accepted';
  exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
\echo 'Pinned questions/price, archive resume, authoritative scoring, idempotent submit, privacy and admission quota passed'
