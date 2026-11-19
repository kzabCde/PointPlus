-- Point+ v3 — DATA-PRESERVING FEATURE ROLLBACK (operator only).
-- This is deliberately NOT a destructive schema downgrade and must be reviewed
-- against the exact, verified PointPlus project after a successful v3 migration.
-- Never run against an unrelated project or before a tested backup/restore.
-- Before executing, pause writes from features using v3 official collections.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF to_regclass('pointplus_private.official_assets') IS NULL
    OR to_regclass('public.room_preferences') IS NULL THEN
   RAISE EXCEPTION 'v3 catalog/preferences not found; rollback is not applicable';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.spaces'::regclass AND tgname='pointplus_official_assets_new_space') THEN
   RAISE EXCEPTION 'Official seed trigger not found; inspect live drift';
 END IF;
END
$guard$;

-- No new Room receives official seeded catalogs until v3 is re-enabled.
-- Existing stamp cards, rows, participant badges and point transactions remain.
ALTER TABLE public.spaces DISABLE TRIGGER pointplus_official_assets_new_space;

-- Disable future official-badge unlocking while keeping earned badges
-- and original v2 global definitions intact.
UPDATE public.badge_definitions b SET active=false
WHERE b.space_id IS NOT NULL AND b.active=true
  AND EXISTS (
    SELECT 1 FROM pointplus_private.official_assets a
    WHERE a.asset_id=b.image_key AND a.kind='badge' AND a.asset_id=b.slug
  );

-- Hide official stamp cards from NEW mission configuration only.
-- v2 award_stamps does not check card.active for existing active missions:
-- operationally pause new reviews until app feature flag/rollback deployed.
UPDATE public.stamp_cards c SET active=false
WHERE c.active=true AND EXISTS(
 SELECT 1 FROM pointplus_private.official_assets a
 WHERE a.asset_id=c.image_key AND a.kind='stamp'
);

-- Preserve all user data; DO NOT DROP tables, rules or kind='group' CHECK:
-- existing group Rooms and foreign keys may depend on them.
COMMIT;

-- To restore v2 evaluator after feature freeze, use its PRE-MIGRATION
-- pg_get_functiondef() captured by the audit/backup process, not a guessed
-- CREATE OR REPLACE FUNCTION. Or apply a separately reviewed forward fix.
-- Feature rollback does NOT reverse transaction history, issue refunds,
-- revoke historical badges or physically restore the old database.
