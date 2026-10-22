-- Additive safety changes. Preserve all existing questions, attempts and files.
begin;

alter table public.tests add column if not exists archived_at timestamptz;
alter table public.tests add constraint tests_archive_inactive
  check (archived_at is null or is_active = false);

insert into public.app_settings (key, value)
values ('support_contact', 'stripeiqtests@proton.me')
on conflict (key) do nothing;

drop policy if exists "Public settings projection" on public.app_settings;
create policy "Public settings projection" on public.app_settings for select
to anon, authenticated using (key in ('language_mode', 'follow_up_test_slug', 'support_contact'));

create or replace function public.get_test_session(p_session_id uuid, p_access_token uuid)
returns table (
  id uuid, test_id uuid, email text, answers jsonb,
  analyst_score numeric, strategist_score numeric, observer_score numeric,
  intuitive_score numeric, overall_score numeric, is_paid boolean,
  stripe_session_id text, completed_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.test_id, s.email,
    case when s.is_paid or public.is_admin() then s.answers end,
    case when s.is_paid or public.is_admin() then s.analyst_score end,
    case when s.is_paid or public.is_admin() then s.strategist_score end,
    case when s.is_paid or public.is_admin() then s.observer_score end,
    case when s.is_paid or public.is_admin() then s.intuitive_score end,
    case when s.is_paid or public.is_admin() then s.overall_score end,
    s.is_paid, s.stripe_session_id, s.completed_at, s.created_at
  from public.test_sessions s
  where s.id = p_session_id and (s.access_token = p_access_token or public.is_admin());
$$;
revoke all on function public.get_test_session(uuid, uuid) from public;
grant execute on function public.get_test_session(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
