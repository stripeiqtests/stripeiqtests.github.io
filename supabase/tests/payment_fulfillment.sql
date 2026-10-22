\set ON_ERROR_STOP on
begin;
create temporary table payment_fixture as
select session_id,access_token from public.submit_test_session(
  '11111111-1111-4111-8111-111111111111','paid-fixture@example.test',
  (select jsonb_object_agg(id::text,correct_answer) from public.questions where test_id='11111111-1111-4111-8111-111111111111'));
create temporary table checkout_fixture(order_id uuid);

do $$
declare s record; a jsonb; b jsonb;
begin
  if has_table_privilege('anon','public.checkout_orders','select') or
     has_table_privilege('authenticated','public.result_email_outbox','select') or
     has_function_privilege('anon','public.fulfill_checkout(uuid,uuid,uuid,text,integer,integer,text)','execute') or
     has_function_privilege('authenticated','public.claim_result_emails(uuid,integer)','execute') then
    raise exception 'Private payment boundary exposed';
  end if;
  select * into s from payment_fixture;
  begin
    perform public.prepare_checkout(s.session_id,gen_random_uuid(),'ru','https://inner-code.me');
    raise exception 'Wrong capability accepted';
  exception when raise_exception then if sqlerrm='Wrong capability accepted' then raise; end if; end;
  a:=public.prepare_checkout(s.session_id,s.access_token,'en','https://inner-code.me');
  update public.tests set price_cents=300 where id='11111111-1111-4111-8111-111111111111';
  b:=public.prepare_checkout(s.session_id,s.access_token,'ru','https://inner-code.me');
  if a->>'id'<>b->>'id' or (b->>'expected_amount')::int<>200 or b->>'language'<>'en' then raise exception 'Checkout snapshot changed'; end if;
  insert into checkout_fixture values((a->>'id')::uuid);
  perform public.attach_checkout((a->>'id')::uuid,'cs_test_fixture');
  begin
    perform public.fulfill_checkout((a->>'id')::uuid,s.session_id,'11111111-1111-4111-8111-111111111111','cs_test_wrong',200,100,'en');
    raise exception 'Wrong checkout accepted';
  exception when raise_exception then if sqlerrm='Wrong checkout accepted' then raise; end if; end;
  if (select is_paid from public.test_sessions where id=s.session_id) then raise exception 'Invalid payment unlocked result'; end if;
  a:=public.fulfill_checkout((a->>'id')::uuid,s.session_id,'11111111-1111-4111-8111-111111111111','cs_test_fixture',200,100,'en');
  if (a->>'alreadyProcessed')::boolean or (a->>'resultAccessToken')::uuid<>s.access_token then raise exception 'Wrong fulfillment'; end if;
  b:=public.fulfill_checkout((select order_id from checkout_fixture),s.session_id,'11111111-1111-4111-8111-111111111111','cs_test_fixture',200,100,'en');
  if not (b->>'alreadyProcessed')::boolean then raise exception 'Repeat was not idempotent'; end if;
  if (select count(*) from public.result_email_outbox where session_id=s.session_id)<>1 then raise exception 'Missing or duplicate mail'; end if;
  if (select overall_score from public.get_test_session(s.session_id,s.access_token))<>100 then raise exception 'Paid result unavailable'; end if;
  update public.tests set is_active=false,archived_at=now() where id='11111111-1111-4111-8111-111111111111';
  if (select (test->>'price_cents')::int from public.get_result_context(s.session_id,s.access_token))<>200 then raise exception 'Archived result context or snapshot lost'; end if;
  if exists(select 1 from public.get_result_context(s.session_id,gen_random_uuid())) then raise exception 'Context accepted wrong capability'; end if;
end $$;

do $$
declare j jsonb; again jsonb; payload jsonb; s uuid;
begin
  select session_id into s from payment_fixture;
  select * into j from public.claim_result_emails(s,5);
  if j is null or (j->>'attempts')::int<>1 then raise exception 'Email not claimed'; end if;
  select * into again from public.claim_result_emails(s,5);
  if again is not null then raise exception 'Two workers claimed same email'; end if;
  payload:=public.set_result_email_payload((j->>'id')::uuid,(j->>'lease_id')::uuid,'{"html":"first"}'::jsonb);
  payload:=public.set_result_email_payload((j->>'id')::uuid,(j->>'lease_id')::uuid,'{"html":"changed"}'::jsonb);
  if payload->>'html'<>'first' then raise exception 'Retry payload changed'; end if;
  if public.finish_result_email((j->>'id')::uuid,gen_random_uuid(),'wrong',null) then raise exception 'Stale lease accepted'; end if;
  if not public.finish_result_email((j->>'id')::uuid,(j->>'lease_id')::uuid,null,'provider_http_503') then raise exception 'Failure not recorded'; end if;
  if (select state from public.result_email_outbox where session_id=s)<>'pending' then raise exception 'Failure lost retry'; end if;
  update public.result_email_outbox set next_attempt_at=now()-interval '1 minute' where session_id=s;
  select * into j from public.claim_result_emails(s,1);
  if (j->>'attempts')::int<>2 or j->'payload'->>'html'<>'first' then raise exception 'Retry not stable'; end if;
  perform public.finish_result_email((j->>'id')::uuid,(j->>'lease_id')::uuid,'provider-fixture',null);
  select * into again from public.claim_result_emails(s,1);
  if again is not null then raise exception 'Sent email reclaimed'; end if;
  update public.result_email_outbox set state='pending',first_attempt_at=now()-interval '24 hours',next_attempt_at=now() where session_id=s;
  select * into again from public.claim_result_emails(s,1);
  if again is not null or (select state from public.result_email_outbox where session_id=s)<>'failed' then raise exception 'Old ambiguous email automatically resent'; end if;
end $$;
rollback;
\echo 'Payment snapshot, capability, fulfillment idempotency and durable email contracts passed'
