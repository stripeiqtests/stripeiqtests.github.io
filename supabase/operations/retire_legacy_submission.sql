-- Release cutover ONLY: apply after pinned-attempt schema, matching functions
-- and frontend are verified. Intentionally excluded from automatic migrations:
-- old clients need this RPC until that coordinated release is complete.
begin;
do $$begin
  if to_regprocedure('public.start_test_attempt(text,uuid)') is null
    or to_regprocedure('public.submit_test_attempt(uuid,text,jsonb)') is null then
    raise exception 'Pinned attempt API must be installed first';
  end if;
end $$;
revoke execute on function public.submit_test_session(uuid,text,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
