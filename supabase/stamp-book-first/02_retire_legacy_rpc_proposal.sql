-- Phase 2 cutover only: retire authenticated access to *legacy* issuance RPCs.
-- NOT APPLIED. Do NOT execute before the NEW Stamp Book UI + schema are live,
-- a backup has been restored successfully, and old clients are drained.
-- Existing point transactions, awards, badges, missions and wallets stay intact.
BEGIN;
SET LOCAL lock_timeout='8s';
DO $guard$
BEGIN
 IF to_regclass('public.stamp_books') IS NULL OR
    to_regclass('public.stamp_book_claims') IS NULL OR
    to_regclass('public.stamp_book_marks') IS NULL THEN
   RAISE EXCEPTION 'New Stamp Book engine not installed: do not retire legacy RPCs';
 END IF;
 IF (SELECT count(*) FROM public.stamp_book_artworks)<>18 THEN
   RAISE EXCEPTION 'New Stamp Book artwork inventory is incomplete';
 END IF;
END $guard$;

-- Do not drop RPCs; revoke public, anon and authenticated execution.
-- This prevents lingering legacy clients from issuing mission-derived stamps,
-- auto-badges and point-based redemption after the controlled cutover.
DO $retire$
DECLARE routine record;
BEGIN
 FOR routine IN SELECT n.nspname,s.proname,pg_get_function_identity_arguments(s.oid) AS args
   FROM pg_proc s JOIN pg_namespace n ON n.oid=s.pronamespace
   WHERE n.nspname='public' AND s.proname IN (
     'pointplus_submit_mission','pointplus_review_mission',
     'pointplus_redeem_reward','pointplus_fulfill_redemption',
     'pointplus_cancel_redemption'
   )
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
     routine.nspname,routine.proname,routine.args);
 END LOOP;
END $retire$;

-- New shared Rooms must not auto-seed obsolete badge and category-card catalogs.
-- Keep all historic cards and awarded badges physically intact.
DO $disable$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.spaces'::regclass
     AND tgname='pointplus_official_assets_new_space' AND NOT tgisinternal)
 THEN
  EXECUTE 'ALTER TABLE public.spaces DISABLE TRIGGER pointplus_official_assets_new_space';
 END IF;
END $disable$;
COMMIT;

-- Recovery: capture original function ACLs and trigger state BEFORE cutover,
-- then restore exact permissions and enabled status via reviewed operator SQL.
-- Never blindly GRANT all roles or delete legacy data.
