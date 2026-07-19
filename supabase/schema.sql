-- Secure bootstrap schema for the IQ Test MVP.
-- Prefer `supabase db push`; this file exists for a new project SQL Editor setup.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.app_settings (key, value)
values ('language_mode', 'ru')
on conflict (key) do nothing;

create table if not exists public.tests (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  description text,
  price_cents integer default 500 check (price_cents between 50 and 100000),
  is_active boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  test_id uuid not null references public.tests(id) on delete cascade,
  question_number integer not null,
  question_text text not null,
  image_url text,
  options jsonb not null,
  correct_answer text not null,
  dimension text not null check (dimension in ('analyst', 'strategist', 'observer', 'intuitive')),
  created_at timestamptz default now(),
  unique (test_id, question_number)
);

create table if not exists public.test_sessions (
  id uuid default gen_random_uuid() primary key,
  test_id uuid not null references public.tests(id),
  email text,
  answers jsonb,
  analyst_score numeric,
  strategist_score numeric,
  observer_score numeric,
  intuitive_score numeric,
  overall_score numeric,
  is_paid boolean default false,
  stripe_session_id text,
  access_token uuid not null default gen_random_uuid(),
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_tests_active on public.tests(is_active);
create index if not exists idx_questions_test_id on public.questions(test_id);
create index if not exists idx_test_sessions_test_id on public.test_sessions(test_id);
create index if not exists idx_test_sessions_stripe on public.test_sessions(stripe_session_id);
create unique index if not exists idx_test_sessions_access_token on public.test_sessions(access_token);

alter table public.app_settings enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.test_sessions enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true',
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "Public settings projection"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('language_mode', 'follow_up_test_slug'));

create policy "Admin manages settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Public reads active tests"
  on public.tests for select
  to anon, authenticated
  using (is_active = true);

create policy "Admin manages tests"
  on public.tests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin manages questions"
  on public.questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.tests from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.test_sessions from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.app_settings to anon, authenticated;
grant insert, update, delete on table public.app_settings to authenticated;
grant select on table public.tests to anon, authenticated;
grant select, insert, update, delete on table public.tests to authenticated;
grant select, insert, update, delete on table public.questions to authenticated;

create or replace function public.get_public_questions(p_test_id uuid)
returns table (
  id uuid,
  test_id uuid,
  question_number integer,
  question_text text,
  image_url text,
  options jsonb,
  dimension text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.test_id, q.question_number, q.question_text,
         q.image_url, q.options, q.dimension, q.created_at
  from public.questions q
  join public.tests t on t.id = q.test_id
  where q.test_id = p_test_id and t.is_active = true
  order by q.question_number;
$$;

create or replace function public.submit_test_session(
  p_test_id uuid,
  p_email text,
  p_answers jsonb
)
returns table (session_id uuid, access_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question_count integer;
  v_answered_count integer;
  v_submitted_count integer;
  v_email text := nullif(trim(p_email), '');
  v_analyst numeric;
  v_strategist numeric;
  v_observer numeric;
  v_intuitive numeric;
  v_session_id uuid;
  v_access_token uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.tests where id = p_test_id and is_active = true) then
    raise exception 'Test is not available' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Answers must be a JSON object' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where p_answers ? q.id::text)
  into v_question_count, v_answered_count
  from public.questions q where q.test_id = p_test_id;

  select count(*)
  into v_submitted_count
  from jsonb_object_keys(p_answers);

  if v_question_count = 0 or v_answered_count <> v_question_count
    or v_submitted_count <> v_question_count then
    raise exception 'Every question must have exactly one answer' using errcode = '22023';
  end if;

  select
    coalesce(100.0 * count(*) filter (where q.dimension = 'analyst' and p_answers ->> q.id::text = q.correct_answer) / nullif(count(*) filter (where q.dimension = 'analyst'), 0), 0),
    coalesce(100.0 * count(*) filter (where q.dimension = 'strategist' and p_answers ->> q.id::text = q.correct_answer) / nullif(count(*) filter (where q.dimension = 'strategist'), 0), 0),
    coalesce(100.0 * count(*) filter (where q.dimension = 'observer' and p_answers ->> q.id::text = q.correct_answer) / nullif(count(*) filter (where q.dimension = 'observer'), 0), 0),
    coalesce(100.0 * count(*) filter (where q.dimension = 'intuitive' and p_answers ->> q.id::text = q.correct_answer) / nullif(count(*) filter (where q.dimension = 'intuitive'), 0), 0)
  into v_analyst, v_strategist, v_observer, v_intuitive
  from public.questions q where q.test_id = p_test_id;

  insert into public.test_sessions (
    test_id, email, answers, analyst_score, strategist_score,
    observer_score, intuitive_score, overall_score, completed_at, access_token
  ) values (
    p_test_id, v_email, p_answers, v_analyst, v_strategist,
    v_observer, v_intuitive,
    (v_analyst + v_strategist + v_observer + v_intuitive) / 4.0,
    now(), v_access_token
  ) returning id into v_session_id;

  return query select v_session_id, v_access_token;
end;
$$;

create or replace function public.get_test_session(p_session_id uuid, p_access_token uuid)
returns table (
  id uuid, test_id uuid, email text, answers jsonb,
  analyst_score numeric, strategist_score numeric, observer_score numeric,
  intuitive_score numeric, overall_score numeric, is_paid boolean,
  stripe_session_id text, completed_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.test_id, s.email, s.answers, s.analyst_score,
         s.strategist_score, s.observer_score, s.intuitive_score,
         s.overall_score, s.is_paid, s.stripe_session_id,
         s.completed_at, s.created_at
  from public.test_sessions s
  where s.id = p_session_id
    and (s.access_token = p_access_token or public.is_admin());
$$;

revoke all on function public.get_public_questions(uuid) from public;
revoke all on function public.submit_test_session(uuid, text, jsonb) from public;
revoke all on function public.get_test_session(uuid, uuid) from public;

grant execute on function public.get_public_questions(uuid) to anon, authenticated;
grant execute on function public.submit_test_session(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_test_session(uuid, uuid) to anon, authenticated;
