\set ON_ERROR_STOP on
begin;
set local role anon;
do $$ begin
  if (select count(*) from public.app_settings where key='result_presentation') <> 1 then
    raise exception 'Public presentation settings unavailable';
  end if;
  if exists(select 1 from public.app_settings where key in('attempt_hourly_limit','attempt_daily_limit')) then
    raise exception 'Private admission settings exposed';
  end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{}}',true);
with changed as(update public.app_settings set value='{}' where key='result_presentation' returning 1)
select count(*)=0 as non_admin_write_blocked from changed \gset
\if :non_admin_write_blocked
\else
  select 1/0;
\endif
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
update public.app_settings set value='{"version":1,"ties":"priority","zero":"observer","priority":["strategist","observer","intuitive","analyst"]}'
where key='result_presentation';
do $$ begin
  if (select value::jsonb->>'ties' from public.app_settings where key='result_presentation') <> 'priority' then
    raise exception 'Admin rule update did not persist';
  end if;
  begin
    update public.app_settings set value=repeat('x',65537) where key='result_presentation';
    raise exception 'Oversized presentation accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
set local role service_role;
do $$ begin
  perform value from public.app_settings where key='result_presentation';
  perform title_ru from public.archetype_results limit 1;
end $$;
reset role;
rollback;
\echo 'Presentation settings RLS/size/worker contracts passed'
