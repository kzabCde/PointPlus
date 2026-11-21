-- Isolated GitHub Actions PostgreSQL fixture; mocks only Storage table layout.
-- NOT a replacement for hosted Supabase Storage integration tests.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(
 id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,
 file_size_limit bigint,allowed_mime_types text[]
);
CREATE TABLE storage.objects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text REFERENCES storage.buckets(id),
 name text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
