-- PointPlus v3.2 reversible feature pause. Retains all existing rows and history.
-- Does NOT roll back v3.1 security revoke/assignment notifications.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF to_regclass('pointplus_private.official_assets') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE
         tgrelid='public.spaces'::regclass
         AND tgname='pointplus_official_assets_new_space') THEN
  RAISE EXCEPTION 'Official Catalog is not installed; stop';
 END IF;
END $guard$;
ALTER TABLE public.spaces DISABLE TRIGGER pointplus_official_assets_new_space;
UPDATE public.badge_definitions b SET active=false
WHERE b.active AND EXISTS (SELECT 1 FROM pointplus_private.official_assets a
  WHERE a.asset_id=b.image_key AND a.kind='badge');
UPDATE public.stamp_cards c SET active=false
WHERE c.active AND EXISTS (SELECT 1 FROM pointplus_private.official_assets a
  WHERE a.asset_id=c.image_key AND a.kind='stamp');
COMMIT;
