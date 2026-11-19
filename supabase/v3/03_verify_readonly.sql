-- Point+ v3 POST-MIGRATION read-only verification.
-- Run ONLY on the verified PointPlus project after an isolated migration.
SELECT kind, count(*) AS rooms FROM public.spaces GROUP BY kind ORDER BY kind;
SELECT kind, mode, count(*) AS count FROM (
 SELECT kind, mode FROM pointplus_private.official_assets
) x GROUP BY kind,mode ORDER BY kind,mode;
SELECT count(*) AS official_count FROM pointplus_private.official_assets;
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='room_preferences';

-- Every old/new space should have six official stamps and four official badges.
WITH cards AS (
 SELECT s.id, s.kind,
        count(DISTINCT c.image_key) FILTER (WHERE oa.kind='stamp') AS stamp_count
 FROM public.spaces s
 LEFT JOIN public.stamp_cards c ON c.space_id=s.id
 LEFT JOIN pointplus_private.official_assets oa ON oa.asset_id=c.image_key
 GROUP BY s.id,s.kind
), badges AS (
 SELECT s.id, count(DISTINCT bd.image_key) FILTER (WHERE oa.kind='badge') AS badge_count
 FROM public.spaces s
 LEFT JOIN public.badge_definitions bd ON bd.space_id=s.id
 LEFT JOIN pointplus_private.official_assets oa ON oa.asset_id=bd.image_key
 GROUP BY s.id
)
SELECT c.kind, count(*) AS rooms, min(c.stamp_count) AS min_stamps,
       max(c.stamp_count) AS max_stamps, min(b.badge_count) AS min_badges,
       max(b.badge_count) AS max_badges,
       count(*) FILTER (WHERE c.stamp_count<>6 OR b.badge_count<>4) AS invalid_rooms
FROM cards c JOIN badges b ON b.id=c.id GROUP BY c.kind ORDER BY c.kind;

-- Exact rule consistency and room mode mapping: all error counts should be ZERO.
SELECT count(*) AS stamp_rule_mismatches
FROM public.stamp_cards c JOIN public.spaces s ON s.id=c.space_id
JOIN pointplus_private.official_assets a ON a.asset_id=c.image_key AND a.kind='stamp'
WHERE c.target_count<>a.stamp_target_count OR c.official_rule_version<>a.rule_version
 OR a.mode<>CASE WHEN s.kind='couple' THEN 'couple'
                 WHEN s.kind='family' THEN 'family' ELSE 'personal' END;

SELECT count(*) AS badge_rule_mismatches
FROM public.badge_definitions b JOIN public.spaces s ON s.id=b.space_id
JOIN pointplus_private.official_assets a ON a.asset_id=b.image_key AND a.kind='badge'
WHERE b.slug<>a.asset_id OR b.criterion<>a.criterion OR b.threshold<>a.threshold
  OR b.required_stamp_asset_id IS DISTINCT FROM a.required_stamp_asset_id
  OR b.official_rule_version<>a.rule_version OR b.rarity<>a.db_rarity
  OR a.mode<>CASE WHEN s.kind='couple' THEN 'couple'
                  WHEN s.kind='family' THEN 'family' ELSE 'personal' END;

SELECT count(*) AS stamp_awards_not_from_approved_submission
FROM public.stamp_awards a JOIN public.mission_submissions sub ON sub.id=a.submission_id
WHERE sub.status<>'approved';

SELECT count(*) AS cross_room_badge_mismatches
FROM public.participant_badges p JOIN public.badge_definitions b ON b.id=p.badge_id
WHERE b.space_id IS NOT NULL AND p.space_id<>b.space_id;

SELECT count(*) AS cross_room_stamp_mismatches
FROM public.stamp_awards a JOIN public.stamp_cycles c ON c.id=a.stamp_cycle_id
WHERE a.space_id<>c.space_id;

-- Ledger reconciliation: report anomalies, do not edit wallets.
SELECT count(*) AS wallet_balance_discrepancies
FROM public.point_wallets w WHERE w.balance<>coalesce((
 SELECT sum(t.amount) FROM public.point_transactions t
 WHERE t.participant_id=w.participant_id AND t.space_id=w.space_id
),0);

-- Check key RLS policies and hidden/privileged catalog; sensitive catalog should
-- have no SELECT permission for anon or authenticated.
SELECT has_table_privilege('anon','pointplus_private.official_assets','SELECT') AS anon_catalog_read,
       has_table_privilege('authenticated','pointplus_private.official_assets','SELECT') AS authenticated_catalog_read;
SELECT policyname,cmd,roles FROM pg_policies WHERE schemaname='public'
 AND tablename='room_preferences' ORDER BY policyname;

-- These SELECTs cannot validate multi-account RLS, real earning, double-click
-- idempotency or metrics; run the E2E plan in docs/DATABASE_V3_DIFF_AND_ROLLBACK.md.
