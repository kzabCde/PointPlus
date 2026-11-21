-- POINT+ — RETIRE LEGACY FINITE STAMP BOOKS/CARDS — PHASE A (data + issuance)
-- Execute once, only after audit. Retains old tables temporarily so the currently
-- deployed pre-cutover app does not crash while Living V3 PR remains unmerged.
-- Migration 22 drops the old table schema ONLY AFTER the Living-only app is deployed.
-- Preserves stamp_book_artworks: 18 art entries are referenced by Living V3 FKs.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='120s';

DO $audit$
BEGIN
  IF to_regclass('public.living_books') IS NULL OR
     to_regclass('public.living_stamp_marks') IS NULL OR
     to_regclass('public.stamp_books') IS NULL OR
     to_regclass('public.stamp_cards') IS NULL OR
     to_regclass('public.stamp_book_artworks') IS NULL
  THEN RAISE EXCEPTION 'Expected Living V3 + legacy tables missing; abort'; END IF;

  -- Abort if concurrent use added new historical records after the user's audit.
  -- Production snapshot: 2026-11-21, prior to the requested removal.
  IF (SELECT count(*) FROM public.stamp_books)<>2 OR
     (SELECT count(*) FROM public.stamp_book_styles)<>36 OR
     (SELECT count(*) FROM public.stamp_book_recipients)<>2 OR
     (SELECT count(*) FROM public.stamp_book_givers)<>2 OR
     (SELECT count(*) FROM public.stamp_book_cycles)<>2 OR
     (SELECT count(*) FROM public.stamp_book_stamp_requests)<>4 OR
     (SELECT count(*) FROM public.stamp_book_marks)<>4 OR
     (SELECT count(*) FROM public.stamp_book_reward_options)<>2 OR
     (SELECT count(*) FROM public.stamp_book_claims)<>0 OR
     (SELECT count(*) FROM public.stamp_cards)<>4 OR
     (SELECT count(*) FROM public.stamp_cycles)<>0 OR
     (SELECT count(*) FROM public.stamp_awards)<>0 OR
     (SELECT count(*) FROM public.stamp_prizes)<>0
  THEN RAISE EXCEPTION
    'Legacy data changed since preflight; re-audit before any destructive migration';
  END IF;

  IF EXISTS(SELECT 1 FROM public.missions WHERE stamp_card_id IS NOT NULL)
     OR EXISTS(SELECT 1 FROM public.mission_submissions
       WHERE stamp_card_snapshot IS NOT NULL)
  THEN RAISE EXCEPTION 'Legacy card still referenced by Mission; abort'; END IF;

  IF (SELECT count(*) FROM public.stamp_book_artworks)<>18
  THEN RAISE EXCEPTION 'Shared Living Book artwork baseline changed; abort'; END IF;
END $audit$;

-- Stop all user-facing legacy creation/grant/review/claim calls.
-- The new pointplus_*living* RPCs are deliberately NOT included.
DO $revoke$
DECLARE f record;
BEGIN
 FOR f IN
   SELECT p.oid::regprocedure AS signature
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
     'pointplus_add_stamp_book_reward',
     'pointplus_claim_couple_memory',
     'pointplus_claim_stamp_book_reward',
     'pointplus_create_paper_stamp_book',
     'pointplus_create_stamp_book',
     'pointplus_give_stamp',
     'pointplus_give_stamp_at',
     'pointplus_give_stamp_freely',
     'pointplus_give_stamp_to_card',
     'pointplus_process_stamp_book_claim',
     'pointplus_review_stamp_request',
     'pointplus_update_stamp_book',
     'pointplus_fulfill_stamp_prize'
   ])
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
 END LOOP;
END $revoke$;

-- New rooms still gain their owner membership, but no starter Stamp Cards.
CREATE OR REPLACE FUNCTION pointplus_private.after_new_space()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 INSERT INTO public.space_members(space_id,user_id,role)
 VALUES(NEW.id,NEW.owner_id,'owner')
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $fn$;

-- Keep seeding unrelated Badge assets, but NEVER seed retired Stamp Cards.
CREATE OR REPLACE FUNCTION pointplus_private.seed_official_asset_catalog(p_space uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_kind text;
 v_owner uuid;
 v_mode text;
BEGIN
 SELECT kind,owner_id INTO v_kind,v_owner
 FROM public.spaces WHERE id=p_space;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown PointPlus Space'; END IF;
 v_mode:=CASE WHEN v_kind='couple' THEN 'couple'
   WHEN v_kind='family' THEN 'family' ELSE 'personal' END;

 INSERT INTO public.badge_definitions(
   space_id,slug,title,description,rarity,image_key,
   criterion,threshold,required_stamp_asset_id,created_by,official_rule_version
 )
 SELECT p_space,b.asset_id,b.title,
  'Official Point+ badge rule v1: '||b.asset_id,
  b.db_rarity,b.asset_id,b.criterion,b.threshold,
  b.required_stamp_asset_id,v_owner,b.rule_version
 FROM pointplus_private.official_assets b
 WHERE b.kind='badge' AND b.mode=v_mode
 ON CONFLICT DO NOTHING;
END $fn$;

-- The deprecated mission engine can still approve missions/points, but its
-- historical Stamp Card bonus is intentionally disabled. No card is recreated.
CREATE OR REPLACE FUNCTION pointplus_private.award_stamps(
 p_space uuid,p_participant uuid,p_card uuid,p_quantity integer,
 p_submission uuid,p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 RETURN;
END $fn$;

-- FK-safe removal of ALL old finite books, placements and claims.
DELETE FROM public.stamp_book_claims;
DELETE FROM public.stamp_book_marks;
DELETE FROM public.stamp_book_stamp_requests;
DELETE FROM public.stamp_book_cycles;
DELETE FROM public.stamp_book_reward_options;
DELETE FROM public.stamp_book_styles;
DELETE FROM public.stamp_book_givers;
DELETE FROM public.stamp_book_recipients;
DELETE FROM public.stamp_books;

-- These were auto-generated legacy cards; there are no mission references
-- and no stamp cycles/awards/prizes according to the locked preflight.
DELETE FROM public.stamp_cards;

-- Verify deletion and protect every new Living Book and shared artwork.
DO $after$
BEGIN
 IF EXISTS(SELECT 1 FROM public.stamp_books)
 OR EXISTS(SELECT 1 FROM public.stamp_book_marks)
 OR EXISTS(SELECT 1 FROM public.stamp_book_stamp_requests)
 OR EXISTS(SELECT 1 FROM public.stamp_cards)
 OR EXISTS(SELECT 1 FROM public.stamp_cycles)
 OR (SELECT count(*) FROM public.stamp_book_artworks)<>18
 THEN RAISE EXCEPTION 'Legacy cleanup incomplete or shared art modified; roll back'; END IF;
END $after$;
COMMIT;
