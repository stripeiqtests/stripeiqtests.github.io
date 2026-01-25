-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies (drop first to ensure clean state or use logic to check existence)
-- Better to drop if exists to ensure we have the correct definition
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Allow image uploads" ON storage.objects;
CREATE POLICY "Allow image uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images');

DROP POLICY IF EXISTS "Allow image deletes" ON storage.objects;
CREATE POLICY "Allow image deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'images');
