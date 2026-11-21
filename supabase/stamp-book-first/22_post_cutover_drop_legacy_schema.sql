-- POINT+ Living Stampbook V3 — POST-CUTOVER removal of the finite Stamp Book schema.
-- STAGE ONLY: do not apply until Living-only PR is merged/deployed and verified.
-- Precondition: migration 21 applied; all legacy data deleted; user-facing app has
-- no legacy queries; mission-side card references are zero.
-- Keep public.stamp_book_artworks and ALL living_* tables forever.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

DO $preflight$
BEGIN
 IF to_regclass('public.living_books') IS NULL
  OR to_regclass('public.living_stamp_marks') IS NULL
  OR to_regclass('public.stamp_book_artworks') IS NULL
  OR to_regclass('public.stamp_books') IS NULL
  OR to_regclass('public.stamp_cards') IS NULL
 THEN RAISE EXCEPTION 'Living/legacy schema precondition failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.stamp_books)
    OR EXISTS(SELECT 1 FROM public.stamp_book_claims)
    OR EXISTS(SELECT 1 FROM public.stamp_book_marks)
    OR EXISTS(SELECT 1 FROM public.stamp_book_stamp_requests)
    OR EXISTS(SELECT 1 FROM public.stamp_cards)
    OR EXISTS(SELECT 1 FROM public.stamp_cycles)
    OR EXISTS(SELECT 1 FROM public.stamp_awards)
    OR EXISTS(SELECT 1 FROM public.stamp_prizes)
 THEN RAISE EXCEPTION 'Legacy data still exists; do not drop schema'; END IF;
 IF EXISTS(SELECT 1 FROM public.missions WHERE stamp_card_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.mission_submissions WHERE stamp_card_snapshot IS NOT NULL)
 THEN RAISE EXCEPTION 'Mission card references still in use'; END IF;
 IF (SELECT count(*) FROM public.stamp_book_artworks)<>18
 THEN RAISE EXCEPTION 'Shared Living V3 artwork changed'; END IF;
END $preflight$;

-- Only legacy external FKs, not missions/submissions themselves.
ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS missions_space_id_stamp_card_id_fkey;
ALTER TABLE public.mission_submissions
  DROP CONSTRAINT IF EXISTS mission_submissions_space_id_stamp_card_snapshot_fkey;

-- Retired v3 official-stamp tables have no earned data and no value to migrate.
DROP TABLE public.stamp_prizes RESTRICT;
DROP TABLE public.stamp_awards RESTRICT;
DROP TABLE public.stamp_cycles RESTRICT;
DROP TABLE public.stamp_cards RESTRICT;

-- Finite Stamp Book ledgers. Shared 18-row artwork catalog is deliberately retained.
DROP TABLE public.stamp_book_claims RESTRICT;
DROP TABLE public.stamp_book_marks RESTRICT;
DROP TABLE public.stamp_book_stamp_requests RESTRICT;
DROP TABLE public.stamp_book_cycles RESTRICT;
DROP TABLE public.stamp_book_reward_options RESTRICT;
DROP TABLE public.stamp_book_styles RESTRICT;
DROP TABLE public.stamp_book_recipients RESTRICT;
DROP TABLE public.stamp_book_givers RESTRICT;
DROP TABLE public.stamp_books RESTRICT;

-- Remove old callable public RPC surfaces. No *living* RPC or art catalogs.
DO $legacy_rpc$
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
 LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s RESTRICT',f.signature);
 END LOOP;
END $legacy_rpc$;

-- Preserve unrelated mission/badge structures and new Living V3.
DO $verified$
BEGIN
 IF to_regclass('public.stamp_books') IS NOT NULL
    OR to_regclass('public.stamp_cards') IS NOT NULL
    OR to_regclass('public.living_books') IS NULL
    OR to_regclass('public.stamp_book_artworks') IS NULL
 THEN RAISE EXCEPTION 'Post-cutover schema invariant failed'; END IF;
END $verified$;
COMMIT;
