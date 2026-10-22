-- Base tables were originally created manually. Keep the subsequent migration
-- history applicable to an empty project as well as an existing deployment.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(), key text unique not null,
  value text not null, created_at timestamptz default now()
);
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(), title text not null,
  description text, price_cents integer default 500,
  is_active boolean default false, created_at timestamptz default now()
);
-- slug is added by 20260123_add_slug_column.sql.
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_number integer not null, question_text text not null, image_url text,
  options jsonb not null, correct_answer text not null,
  dimension text not null check (dimension in ('analyst', 'strategist', 'observer', 'intuitive')),
  created_at timestamptz default now(), unique(test_id, question_number)
);
create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id),
  email text, answers jsonb, analyst_score numeric, strategist_score numeric,
  observer_score numeric, intuitive_score numeric, overall_score numeric,
  is_paid boolean default false, stripe_session_id text, completed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.app_settings enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.test_sessions enable row level security;
create index if not exists idx_questions_test_id on public.questions(test_id);
create index if not exists idx_test_sessions_test_id on public.test_sessions(test_id);
