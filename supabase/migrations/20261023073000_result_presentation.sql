-- Add presentation rules without changing any scores, questions or authored profiles.
begin;
insert into public.app_settings(key,value)
select 'result_presentation', jsonb_build_object(
  'version',1,'ties','mixed','zero','none',
  'priority',jsonb_build_array('analyst','strategist','observer','intuitive'),
  'messages',jsonb_build_object('emailSent',jsonb_strip_nulls(jsonb_build_object(
    'ru',(select value from public.home_content where key='results_email_sent_ru' and length(value) between 1 and 1000),
    'en',(select value from public.home_content where key='results_email_sent_en' and length(value) between 1 and 1000)
  )))
)::text on conflict(key) do nothing;

alter table public.app_settings add constraint result_presentation_size
  check (key <> 'result_presentation' or octet_length(value) <= 65536);

drop policy if exists "Public settings projection" on public.app_settings;
create policy "Public settings projection" on public.app_settings for select
  to anon, authenticated using(key in('language_mode','follow_up_test_slug','support_contact','result_presentation'));
-- The shared mail worker reads only these presentation/archetype rows.
grant select on public.archetype_results to service_role;
commit;
