-- PointPlus Interactive Stampbook v2: additive placement metadata.
-- TARGET ONLY: gczribbtkfvhpzzupqre. Stage and test before applying to live.
-- Prerequisite: current Stamp Book First + Couple Memory schema.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.stamp_books') IS NULL
     OR to_regclass('public.stamp_book_marks') IS NULL
     OR to_regclass('public.stamp_book_stamp_requests') IS NULL
     OR to_regprocedure('public.pointplus_give_stamp(uuid,uuid,text,text,uuid)') IS NULL
     OR to_regprocedure('public.pointplus_create_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[])') IS NULL
  THEN RAISE EXCEPTION 'PointPlus Stamp Book baseline not installed; aborting'; END IF;
END $preflight$;

ALTER TABLE public.stamp_books
  ADD COLUMN IF NOT EXISTS layout_mode text NOT NULL DEFAULT 'notebook';
ALTER TABLE public.stamp_books
  DROP CONSTRAINT IF EXISTS stamp_books_layout_mode_check;
ALTER TABLE public.stamp_books
  ADD CONSTRAINT stamp_books_layout_mode_check CHECK (layout_mode IN ('single_sheet','notebook'));

ALTER TABLE public.stamp_book_stamp_requests
  ADD COLUMN IF NOT EXISTS page_index integer,
  ADD COLUMN IF NOT EXISTS position_x numeric,
  ADD COLUMN IF NOT EXISTS position_y numeric,
  ADD COLUMN IF NOT EXISTS rotation_deg numeric;
ALTER TABLE public.stamp_book_marks
  ADD COLUMN IF NOT EXISTS page_index integer,
  ADD COLUMN IF NOT EXISTS position_x numeric,
  ADD COLUMN IF NOT EXISTS position_y numeric,
  ADD COLUMN IF NOT EXISTS rotation_deg numeric;

ALTER TABLE public.stamp_book_stamp_requests
  DROP CONSTRAINT IF EXISTS stamp_book_requests_paper_position_check;
ALTER TABLE public.stamp_book_stamp_requests
  ADD CONSTRAINT stamp_book_requests_paper_position_check CHECK (
    (page_index IS NULL AND position_x IS NULL AND position_y IS NULL AND rotation_deg IS NULL)
    OR (page_index BETWEEN 0 AND 99 AND position_x BETWEEN 0 AND 1
        AND position_y BETWEEN 0 AND 1 AND rotation_deg BETWEEN -15 AND 15)
  );
ALTER TABLE public.stamp_book_marks
  DROP CONSTRAINT IF EXISTS stamp_book_marks_paper_position_check;
ALTER TABLE public.stamp_book_marks
  ADD CONSTRAINT stamp_book_marks_paper_position_check CHECK (
    (page_index IS NULL AND position_x IS NULL AND position_y IS NULL AND rotation_deg IS NULL)
    OR (page_index BETWEEN 0 AND 99 AND position_x BETWEEN 0 AND 1
        AND position_y BETWEEN 0 AND 1 AND rotation_deg BETWEEN -15 AND 15)
  );

-- Newly approved requests inherit their saved positions automatically.
-- Legacy issuance remains fully functional with NULL position fields.
CREATE OR REPLACE FUNCTION pointplus_private.book_copy_paper_position()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $func$
BEGIN
  IF NEW.page_index IS NULL THEN
    SELECT r.page_index, r.position_x, r.position_y, r.rotation_deg
    INTO NEW.page_index, NEW.position_x, NEW.position_y, NEW.rotation_deg
    FROM public.stamp_book_stamp_requests r WHERE r.id = NEW.request_id;
  END IF;
  RETURN NEW;
END $func$;
DROP TRIGGER IF EXISTS pointplus_stamp_mark_position_copy ON public.stamp_book_marks;
CREATE TRIGGER pointplus_stamp_mark_position_copy
BEFORE INSERT ON public.stamp_book_marks
FOR EACH ROW EXECUTE FUNCTION pointplus_private.book_copy_paper_position();

-- A new name keeps the old 11-argument creation RPC unambiguous.
-- Both book creation and layout metadata happen in one transaction.
CREATE OR REPLACE FUNCTION public.pointplus_create_paper_stamp_book(
  p_space uuid, p_title text, p_description text, p_target integer,
  p_repeatable boolean, p_allow_self boolean, p_approval text,
  p_recipients uuid[], p_givers uuid[], p_styles text[], p_rewards text[],
  p_layout text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE v_book uuid;
BEGIN
  IF auth.uid() IS NULL OR p_layout IS NULL OR p_layout NOT IN ('single_sheet','notebook') THEN
    RAISE EXCEPTION 'Invalid paper layout or authentication';
  END IF;
  v_book := public.pointplus_create_stamp_book(
    p_space, p_title, p_description, p_target, p_repeatable, p_allow_self,
    p_approval, p_recipients, p_givers, p_styles, p_rewards
  );
  UPDATE public.stamp_books SET layout_mode = p_layout WHERE id = v_book;
  RETURN v_book;
END $func$;

-- Versioned placement RPC calls the existing guarded issuer, preserving all its
-- authority, book-state, cycle-limit and idempotency validations. The entire
-- invocation is one database transaction: no half-persisted placement is visible.
CREATE OR REPLACE FUNCTION public.pointplus_give_stamp_at(
  p_book uuid, p_recipient uuid, p_art text, p_note text, p_key uuid,
  p_page integer, p_x numeric, p_y numeric, p_rotation numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
  v_book public.stamp_books%ROWTYPE;
  v_prior public.stamp_book_stamp_requests%ROWTYPE;
  v_result jsonb;
  v_request uuid;
  v_max_page integer;
BEGIN
  IF auth.uid() IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Authentication/idempotency key required';
  END IF;
  SELECT * INTO v_book FROM public.stamp_books WHERE id = p_book;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;

  v_max_page := CASE WHEN v_book.layout_mode = 'single_sheet'
    THEN 0 ELSE (v_book.target_count - 1) / 8 END;
  IF p_page IS NULL OR p_page NOT BETWEEN 0 AND v_max_page
    OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1
    OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
    OR p_rotation IS NULL OR p_rotation NOT BETWEEN -15 AND 15
  THEN RAISE EXCEPTION 'Invalid stamp placement coordinates'; END IF;

  SELECT * INTO v_prior FROM public.stamp_book_stamp_requests
    WHERE book_id = p_book AND giver_user_id = auth.uid() AND idempotency_key = p_key;
  IF FOUND AND (v_prior.page_index IS DISTINCT FROM p_page
      OR v_prior.position_x IS DISTINCT FROM p_x
      OR v_prior.position_y IS DISTINCT FROM p_y
      OR v_prior.rotation_deg IS DISTINCT FROM p_rotation)
  THEN RAISE EXCEPTION 'Idempotency key already used with different placement'; END IF;

  v_result := public.pointplus_give_stamp(p_book, p_recipient, p_art, p_note, p_key);
  v_request := (v_result->>'request_id')::uuid;
  IF v_request IS NULL THEN RAISE EXCEPTION 'Missing stamp request receipt'; END IF;
  UPDATE public.stamp_book_stamp_requests
    SET page_index = p_page, position_x = p_x, position_y = p_y, rotation_deg = p_rotation
    WHERE id = v_request;
  -- Direct-approval marks were inserted by the existing RPC before coordinates
  -- were attached to the request; reconcile inside this same transaction.
  UPDATE public.stamp_book_marks
    SET page_index = p_page, position_x = p_x, position_y = p_y, rotation_deg = p_rotation
    WHERE request_id = v_request;
  RETURN v_result;
END $func$;

REVOKE ALL ON FUNCTION public.pointplus_create_paper_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[],text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_create_paper_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[],text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.pointplus_give_stamp_at(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_give_stamp_at(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric)
  TO authenticated;
REVOKE ALL ON FUNCTION pointplus_private.book_copy_paper_position() FROM PUBLIC, anon, authenticated;

COMMIT;
