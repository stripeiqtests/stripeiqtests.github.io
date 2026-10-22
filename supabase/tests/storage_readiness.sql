-- Read-only deployment/recovery gate. Run against the intended project.
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'images' and name = 'images' and public
  ) then
    raise exception 'Question image storage is missing or not public';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admin manages question images'
      and cmd = 'ALL' and roles = array['authenticated']::name[]
      and qual like '%bucket_id%images%is_admin()%'
      and with_check like '%bucket_id%images%is_admin()%'
  ) then
    raise exception 'Admin-only image write policy is missing or unexpected';
  end if;
end;
$$;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'images';
