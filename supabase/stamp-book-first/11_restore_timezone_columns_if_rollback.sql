-- Restore shape for old clients if needed. Data from deleted timezone
-- columns cannot be perfectly restored without a pre-migration backup.
-- All existing records will use default Asia/Bangkok in a rollback.
BEGIN;
SET LOCAL lock_timeout='8s';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Bangkok';
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Bangkok';
COMMIT;
