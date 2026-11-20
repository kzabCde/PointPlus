-- PointPlus Stamp Card + Stamp Book Choice.
-- Target only: gczribbtkfvhpzzupqre; requires the existing v2 paper schema.
-- Adds a card layout variant to the existing stamp_books ledger, with no new reward flow.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.stamp_books') IS NULL
     OR to_regprocedure('public.pointplus_create_paper_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[],text)') IS NULL
     OR NOT EXISTS(
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.stamp_books'::regclass
         AND conname = 'stamp_books_layout_mode_check'
     )
  THEN RAISE EXCEPTION 'PointPlus paper book v2 baseline missing; abort'; END IF;
END $preflight$;

-- Keep every existing notebook and single_sheet record as-is.
-- Cards use the same stamp_books, cycles, marks, requests and claims.
ALTER TABLE public.stamp_books
  DROP CONSTRAINT stamp_books_layout_mode_check;
ALTER TABLE public.stamp_books
  ADD CONSTRAINT stamp_books_layout_mode_check
  CHECK (layout_mode IN ('single_sheet','notebook','stamp_card'));

-- A creator may now pick a fixed-slot card or a free-placement notebook.
-- Authorization, recipient/giver setup, and reward insertion are still
-- delegated atomically to the original validated creation RPC.
CREATE OR REPLACE FUNCTION public.pointplus_create_paper_stamp_book(
  p_space uuid, p_title text, p_description text, p_target integer,
  p_repeatable boolean, p_allow_self boolean, p_approval text,
  p_recipients uuid[], p_givers uuid[], p_styles text[], p_rewards text[],
  p_layout text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_book uuid;
BEGIN
  IF auth.uid() IS NULL OR p_layout IS NULL
     OR p_layout NOT IN ('single_sheet','notebook','stamp_card') THEN
    RAISE EXCEPTION 'Invalid collection layout or authentication';
  END IF;
  v_book := public.pointplus_create_stamp_book(
    p_space,p_title,p_description,p_target,p_repeatable,p_allow_self,
    p_approval,p_recipients,p_givers,p_styles,p_rewards
  );
  UPDATE public.stamp_books SET layout_mode=p_layout WHERE id=v_book;
  RETURN v_book;
END $function$;

-- Maintain the previous minimum-privilege PostgREST RPC exposure.
REVOKE ALL ON FUNCTION public.pointplus_create_paper_stamp_book(
  uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[],text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_create_paper_stamp_book(
  uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[],text
) TO authenticated;
COMMIT;
