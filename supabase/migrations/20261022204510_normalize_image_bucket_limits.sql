-- A cold installation previously kept the unlimited bucket inserted in 2026-01.
-- This changes NEW writes only; existing objects and their URLs are preserved.
update storage.buckets set
  file_size_limit=least(coalesce(file_size_limit,5242880),5242880),
  allowed_mime_types=array['image/png','image/jpeg','image/gif','image/webp']::text[]
where id='images';
