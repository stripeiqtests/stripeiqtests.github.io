-- The frontend and existing RLS policies use this bucket. Restoring database
-- tables and policies alone does not recreate the Storage bucket.
-- Public question illustrations; writes remain protected by storage.objects RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/*'])
on conflict (id) do nothing;
