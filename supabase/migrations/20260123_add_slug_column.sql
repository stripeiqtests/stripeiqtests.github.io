-- Add slug column to tests table (without unique constraint first)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing tests using ID for uniqueness
UPDATE tests 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Now add unique constraint
ALTER TABLE tests ADD CONSTRAINT tests_slug_key UNIQUE (slug);

-- Make slug required for future entries
ALTER TABLE tests ALTER COLUMN slug SET NOT NULL;
