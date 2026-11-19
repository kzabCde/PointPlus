-- PointPlus v3.2: resume the previously paused, verified Official Collections.
-- Target: gczribbtkfvhpzzupqre (Que168). Non-destructive feature restoration.
-- Earlier v3 catalog and triggers are already present; NEVER run 02_upgrade_proposal.sql.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='60s';

DO $preflight$
BEGIN
  IF to_regclass('pointplus_private.official_assets') IS NULL
     OR to_regclass('public.spaces') IS NULL
     OR to_regclass('public.stamp_cards') IS NULL
     OR to_regclass('public.badge_definitions') IS NULL THEN
    RAISE EXCEPTION 'Missing PointPlus v3 objects: no change performed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.spaces'::regclass
        AND tgname='pointplus_official_assets_new_space' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Expected official seeding trigger missing';
  END IF;
  IF (SELECT count(*) FROM pointplus_private.official_assets)<>30
     OR (SELECT count(*) FROM pointplus_private.official_assets WHERE kind='stamp')<>18
     OR (SELECT count(*) FROM pointplus_private.official_assets WHERE kind='badge')<>12 THEN
    RAISE EXCEPTION 'Unexpected official catalog inventory';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE (SELECT count(*) FROM public.stamp_cards c
       JOIN pointplus_private.official_assets a ON a.asset_id=c.image_key
         AND a.kind='stamp' AND a.mode=CASE
            WHEN s.kind='couple' THEN 'couple'
            WHEN s.kind='family' THEN 'family' ELSE 'personal' END
       WHERE c.space_id=s.id)<>6
      OR (SELECT count(*) FROM public.badge_definitions b
       JOIN pointplus_private.official_assets a ON a.asset_id=b.image_key
         AND a.kind='badge' AND a.mode=CASE
            WHEN s.kind='couple' THEN 'couple'
            WHEN s.kind='family' THEN 'family' ELSE 'personal' END
       WHERE b.space_id=s.id)<>4
  ) THEN
    RAISE EXCEPTION 'Existing Room asset catalog incomplete; reconcile before enabling';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.stamp_cards c
    JOIN pointplus_private.official_assets a
      ON a.asset_id=c.image_key AND a.kind='stamp'
    WHERE c.target_count<>a.stamp_target_count
       OR c.official_rule_version<>a.rule_version
  ) OR EXISTS (
    SELECT 1 FROM public.badge_definitions b
    JOIN pointplus_private.official_assets a
      ON a.asset_id=b.image_key AND a.kind='badge'
    WHERE b.criterion<>a.criterion OR b.threshold<>a.threshold
       OR b.rarity<>a.db_rarity OR b.official_rule_version<>a.rule_version
       OR b.required_stamp_asset_id IS DISTINCT FROM a.required_stamp_asset_id
  ) THEN
    RAISE EXCEPTION 'Official earning-rule drift detected';
  END IF;
END
$preflight$;

ALTER TABLE public.spaces ENABLE TRIGGER pointplus_official_assets_new_space;

-- Only restore original official catalog rows; never touch user-created cards,
-- points, submitted proof, historical badges, wallets, children, or memberships.
UPDATE public.stamp_cards c
SET active=true
FROM pointplus_private.official_assets a, public.spaces s
WHERE c.space_id=s.id AND c.image_key=a.asset_id
  AND a.kind='stamp'
  AND a.mode=CASE WHEN s.kind='couple' THEN 'couple'
                  WHEN s.kind='family' THEN 'family' ELSE 'personal' END
  AND NOT c.active;

UPDATE public.badge_definitions b
SET active=true
FROM pointplus_private.official_assets a, public.spaces s
WHERE b.space_id=s.id AND b.image_key=a.asset_id
  AND a.kind='badge'
  AND a.mode=CASE WHEN s.kind='couple' THEN 'couple'
                  WHEN s.kind='family' THEN 'family' ELSE 'personal' END
  AND NOT b.active;
COMMIT;
