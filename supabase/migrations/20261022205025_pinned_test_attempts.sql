begin;
create table public.test_versions(
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id),
  content_hash text not null unique,
  test_snapshot jsonb not null,
  question_snapshot jsonb not null,
  scoring_version text not null default 'dimension-mean-v1',
  created_at timestamptz not null default now()
);
create index test_versions_test on public.test_versions(test_id);
create table public.test_attempts(
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  version_id uuid not null references public.test_versions(id),
  result_session_id uuid unique references public.test_sessions(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days'
);
create index test_attempts_expiry on public.test_attempts(expires_at) where result_session_id is null;
create index test_attempts_version on public.test_attempts(version_id);
create table public.attempt_admission_counts(
  bucket text primary key,
  starts_at timestamptz not null,
  count integer not null check(count>=0)
);
alter table public.test_versions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.attempt_admission_counts enable row level security;
revoke all on public.test_versions,public.test_attempts,public.attempt_admission_counts from anon,authenticated;
alter table public.test_sessions add column version_id uuid references public.test_versions(id);
create index test_sessions_version on public.test_sessions(version_id);

-- These are global storage-abuse circuit breakers, not a claim to identify a
-- person by a browser-controlled IP/header. Retries of an admitted token are free.
-- An admin may tune the private limits for legitimate traffic; 0 never disables.
insert into public.app_settings(key,value) values('attempt_hourly_limit','100'),('attempt_daily_limit','500') on conflict(key) do nothing;

create function public.start_test_attempt(p_slug text,p_attempt_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; v public.test_versions; t public.tests;
  snapshot jsonb; qs jsonb; question_row jsonb; opts jsonb; version_hash text; n integer;
  hourly integer:=100; daily integer:=500; bucket_start timestamptz; bucket_limit integer; bucket_key text; admitted integer;
begin
  if p_attempt_token is null or p_slug is null or length(p_slug)>200 then raise exception 'Invalid attempt'; end if;
  perform pg_advisory_xact_lock(hashtextextended('attempt:'||p_attempt_token::text,0));
  select * into a from public.test_attempts where token_hash=sha256(convert_to(p_attempt_token::text,'utf8'));
  if found then
    select * into strict v from public.test_versions where id=a.version_id;
    if v.test_snapshot->>'slug'<>p_slug then raise exception 'Attempt mismatch'; end if;
    if a.expires_at<=now() and a.result_session_id is null then raise exception 'Attempt expired' using errcode='P0002'; end if;
  else
    select * into t from public.tests where slug=p_slug and is_active and archived_at is null;
    if not found then raise exception 'Test not available' using errcode='P0002'; end if;
    select jsonb_agg(to_jsonb(q) order by q.question_number) into qs from public.questions q where q.test_id=t.id;
    n:=coalesce(jsonb_array_length(qs),0);
    if n<1 or n>200 or octet_length(qs::text)>262144 then raise exception 'Test has invalid question count or size'; end if;
    -- Normalize legacy JSON-encoded strings once on the server. No client sees
    -- the correct answers, which remain inside the private immutable version.
    for question_row in select value from jsonb_array_elements(qs) loop
      if question_row->>'dimension' is null or question_row->>'dimension' not in ('analyst','strategist','observer','intuitive') then raise exception 'Invalid question dimension'; end if;
      opts:=question_row->'options';
      if jsonb_typeof(opts)='string' then opts:=(opts#>>'{}')::jsonb; end if;
      if jsonb_typeof(opts) is distinct from 'array' then raise exception 'Invalid options'; end if;
      if jsonb_array_length(opts) not between 2 and 12 or exists(select 1 from jsonb_array_elements(opts) o
        where jsonb_typeof(o->'label') is distinct from 'string' or nullif(btrim(o->>'label'),'') is null
          or jsonb_typeof(o->'value') is distinct from 'string' or nullif(btrim(o->>'value'),'') is null)
        or (select count(distinct o->>'label') from jsonb_array_elements(opts) o)<>jsonb_array_length(opts)
        or not exists(select 1 from jsonb_array_elements(opts) o where o->>'label'=question_row->>'correct_answer') then raise exception 'Invalid options'; end if;
    end loop;
    select jsonb_agg(case when jsonb_typeof(q->'options')='string' then jsonb_set(q,'{options}',(q->>'options')::jsonb) else q end order by ord)
      into qs from jsonb_array_elements(qs) with ordinality e(q,ord);
    snapshot:=to_jsonb(t);
    if t.price_cents not between 50 and 100000 or t.price_cents is null then raise exception 'Invalid price'; end if;
    select coalesce(max(case when key='attempt_hourly_limit' and value~'^[0-9]{1,6}$' then greatest(1,least(100000,value::integer)) end),100),
      coalesce(max(case when key='attempt_daily_limit' and value~'^[0-9]{1,6}$' then greatest(1,least(100000,value::integer)) end),500)
      into hourly,daily from public.app_settings where key in ('attempt_hourly_limit','attempt_daily_limit');
    -- One short lock admits new rows consistently across concurrent callers.
    perform pg_advisory_xact_lock(hashtextextended('attempt-admission',0));
    for bucket_key,bucket_start,bucket_limit in
      select 'hour:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH'),date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC',hourly
      union all select 'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',daily
    loop
      insert into public.attempt_admission_counts(bucket,starts_at,count) values(bucket_key,bucket_start,1)
        on conflict(bucket) do update set count=public.attempt_admission_counts.count+1 returning count into admitted;
      if admitted>bucket_limit then raise exception 'New attempt limit reached. Retry later.' using errcode='54000'; end if;
    end loop;
    delete from public.attempt_admission_counts where starts_at<now()-interval '2 days';
    -- Bound abandoned capability retention without touching submitted results.
    -- Skip locked rows so an unrelated submission cannot block admission.
    delete from public.test_attempts where id in(select id from public.test_attempts
      where expires_at<now() and result_session_id is null order by expires_at limit 100 for update skip locked);
    delete from public.test_versions orphan_version where orphan_version.id in(select stored_version.id from public.test_versions stored_version
      where not exists(select 1 from public.test_attempts stored_attempt where stored_attempt.version_id=stored_version.id)
        and not exists(select 1 from public.test_sessions stored_session where stored_session.version_id=stored_version.id)
      limit 100 for update skip locked);
    version_hash:=encode(sha256(convert_to(jsonb_build_object('test',snapshot,'questions',qs,'algorithm','dimension-mean-v1')::text,'utf8')),'hex');
    insert into public.test_versions(test_id,content_hash,test_snapshot,question_snapshot) values(t.id,version_hash,snapshot,qs)
      on conflict(content_hash) do nothing;
    select * into strict v from public.test_versions where content_hash=version_hash;
    insert into public.test_attempts(token_hash,version_id) values(sha256(convert_to(p_attempt_token::text,'utf8')),v.id) returning * into a;
  end if;
  return jsonb_build_object('test',v.test_snapshot,'version_id',v.id,'expires_at',a.expires_at,
    'questions',(select jsonb_agg(q-'correct_answer' order by ord) from jsonb_array_elements(v.question_snapshot) with ordinality e(q,ord)));
end $$;

create function public.submit_test_attempt(p_attempt_token uuid,p_email text,p_answers jsonb)
returns table(session_id uuid,access_token uuid) language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; v public.test_versions; s public.test_sessions; question_row jsonb; opts jsonb;
  mail text:=nullif(btrim(p_email),''); analyst numeric; strategist numeric; observer numeric; intuitive numeric;
begin
  select * into a from public.test_attempts where token_hash=sha256(convert_to(p_attempt_token::text,'utf8')) for update;
  if not found then raise exception 'Attempt not found' using errcode='P0002'; end if;
  if a.result_session_id is not null then
    return query select r.id,r.access_token from public.test_sessions r where r.id=a.result_session_id;return;
  end if;
  if a.expires_at<=now() then raise exception 'Attempt expired' using errcode='P0002'; end if;
  select * into strict v from public.test_versions where id=a.version_id;
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>16384 then raise exception 'Invalid answers'; end if;
  if mail is not null and (length(mail)>320 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid email'; end if;
  if (select count(*) from jsonb_object_keys(p_answers))<>jsonb_array_length(v.question_snapshot) then raise exception 'Every question must have one answer'; end if;
  for question_row in select value from jsonb_array_elements(v.question_snapshot) loop
    opts:=question_row->'options';
    if jsonb_typeof(p_answers->(question_row->>'id')) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(opts) o where o->>'label'=p_answers->>(question_row->>'id')) then raise exception 'Invalid answer option'; end if;
  end loop;
  select coalesce(100.0*count(*) filter(where q->>'dimension'='analyst' and p_answers->>(q->>'id')=q->>'correct_answer')/nullif(count(*) filter(where q->>'dimension'='analyst'),0),0),
    coalesce(100.0*count(*) filter(where q->>'dimension'='strategist' and p_answers->>(q->>'id')=q->>'correct_answer')/nullif(count(*) filter(where q->>'dimension'='strategist'),0),0),
    coalesce(100.0*count(*) filter(where q->>'dimension'='observer' and p_answers->>(q->>'id')=q->>'correct_answer')/nullif(count(*) filter(where q->>'dimension'='observer'),0),0),
    coalesce(100.0*count(*) filter(where q->>'dimension'='intuitive' and p_answers->>(q->>'id')=q->>'correct_answer')/nullif(count(*) filter(where q->>'dimension'='intuitive'),0),0)
    into analyst,strategist,observer,intuitive from jsonb_array_elements(v.question_snapshot) q;
  insert into public.test_sessions(test_id,version_id,email,answers,analyst_score,strategist_score,observer_score,intuitive_score,overall_score,completed_at)
    values(v.test_id,v.id,mail,p_answers,analyst,strategist,observer,intuitive,(analyst+strategist+observer+intuitive)/4.0,now()) returning * into s;
  update public.test_attempts set result_session_id=s.id where id=a.id;
  return query select s.id,s.access_token;
end $$;

revoke all on function public.start_test_attempt(text,uuid),public.submit_test_attempt(uuid,text,jsonb) from public;
grant execute on function public.start_test_attempt(text,uuid),public.submit_test_attempt(uuid,text,jsonb) to anon,authenticated;
grant select on public.test_versions,public.test_attempts to service_role;

create or replace function public.prepare_checkout(p_session_id uuid,p_access_token uuid,p_language text,p_origin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.test_sessions;t public.tests;o public.checkout_orders;version_snapshot jsonb;
begin
  select * into s from public.test_sessions where id=p_session_id for update;
  if not found or s.access_token is distinct from p_access_token then raise exception 'Session not found'; end if;
  if s.is_paid then raise exception 'Already paid'; end if;
  if p_language is null or p_origin is null or p_language not in ('ru','en') or p_origin not in ('https://inner-code.me','https://www.inner-code.me','https://stripeiqtests.github.io','http://localhost:5173','http://127.0.0.1:5173') then raise exception 'Invalid checkout context'; end if;
  update public.checkout_orders set state='expired' where session_id=s.id and state='pending' and expires_at<=now();
  select * into o from public.checkout_orders where session_id=s.id and state='pending';
  if not found then
    select * into strict t from public.tests where id=s.test_id;
    if s.version_id is not null then
      select test_snapshot into strict version_snapshot from public.test_versions where id=s.version_id;
      t.title:=version_snapshot->>'title';t.price_cents:=(version_snapshot->>'price_cents')::integer;
    end if;
    insert into public.checkout_orders(session_id,test_id,title,expected_amount,language,return_origin)
      values(s.id,t.id,t.title,t.price_cents,p_language,p_origin) returning * into o;
  end if;
  return to_jsonb(o)||jsonb_build_object('email',s.email);
end $$;

create or replace function public.get_result_context(p_session_id uuid,p_access_token uuid)
returns table(test jsonb,email_status text) language sql stable security definer set search_path='' as $$
  select coalesce(v.test_snapshot,to_jsonb(t))||jsonb_build_object('title',coalesce(o.title,v.test_snapshot->>'title',t.title),
    'price_cents',coalesce(o.expected_amount,(v.test_snapshot->>'price_cents')::integer,t.price_cents)),e.state
  from public.test_sessions s join public.tests t on t.id=s.test_id
  left join public.test_versions v on v.id=s.version_id
  left join lateral(select title,expected_amount from public.checkout_orders where session_id=s.id order by (state='paid') desc,created_at desc limit 1)o on true
  left join public.result_email_outbox e on e.session_id=s.id
  where s.id=p_session_id and (s.access_token=p_access_token or public.is_admin());
$$;
-- Existing grants remain unchanged by CREATE OR REPLACE.
notify pgrst,'reload schema';
commit;
