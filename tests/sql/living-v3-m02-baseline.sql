-- Minimal Supabase auth/Room baseline for PostgreSQL CI only. No production data.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA pointplus_private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  name text
);
CREATE TABLE public.space_members (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL,
  PRIMARY KEY(space_id,user_id)
);
CREATE TABLE public.participants (
  id uuid PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.spaces(id),
  kind text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  guardian_user_id uuid REFERENCES auth.users(id),
  archived_at timestamptz,
  UNIQUE(space_id,id)
);
CREATE TABLE public.stamp_book_artworks(asset_id text PRIMARY KEY);
CREATE TABLE public.stamp_books(id uuid PRIMARY KEY);
GRANT SELECT ON public.spaces,public.space_members,public.participants TO authenticated;
INSERT INTO auth.users(id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.spaces(id,kind,owner_id,name) VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','couple','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test Couple');
INSERT INTO public.space_members(space_id,user_id,role) VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','member');
INSERT INTO public.participants(id,space_id,kind,user_id) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','adult','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','adult','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.stamp_book_artworks(asset_id) VALUES('heart');
