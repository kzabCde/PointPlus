-- PointPlus Interactive Stampbook v2.1: freely rotate 360 degrees and scale 40-250%.
-- Target: gczribbtkfvhpzzupqre. Additive; preserves approved marks and archived memories.
-- Requires applied 20261120094702 pointplus_interactive_paper_stampbook_v2.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.stamp_books') IS NULL
    OR to_regprocedure('public.pointplus_give_stamp_at(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric)') IS NULL
    OR to_regprocedure('pointplus_private.book_copy_paper_position()') IS NULL
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='stamp_book_marks' AND column_name='rotation_deg')
  THEN RAISE EXCEPTION 'PointPlus v2 paper baseline is missing; refusing to apply'; END IF;
  IF to_regprocedure('public.pointplus_give_stamp_freely(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric,numeric)') IS NOT NULL
  THEN RAISE EXCEPTION 'Free transform migration already applied'; END IF;
END $preflight$;

ALTER TABLE public.stamp_book_stamp_requests
  ADD COLUMN IF NOT EXISTS scale_factor numeric;
ALTER TABLE public.stamp_book_marks
  ADD COLUMN IF NOT EXISTS scale_factor numeric;

ALTER TABLE public.stamp_book_stamp_requests
  DROP CONSTRAINT IF EXISTS stamp_book_requests_paper_position_check;
ALTER TABLE public.stamp_book_stamp_requests
  ADD CONSTRAINT stamp_book_requests_paper_position_check CHECK (
    (page_index IS NULL AND position_x IS NULL AND position_y IS NULL AND rotation_deg IS NULL)
    OR (page_index IS NOT NULL AND position_x IS NOT NULL AND position_y IS NOT NULL AND rotation_deg IS NOT NULL
      AND page_index BETWEEN 0 AND 99 AND position_x BETWEEN 0 AND 1
      AND position_y BETWEEN 0 AND 1 AND rotation_deg BETWEEN -180 AND 180)
  );
ALTER TABLE public.stamp_book_marks
  DROP CONSTRAINT IF EXISTS stamp_book_marks_paper_position_check;
ALTER TABLE public.stamp_book_marks
  ADD CONSTRAINT stamp_book_marks_paper_position_check CHECK (
    (page_index IS NULL AND position_x IS NULL AND position_y IS NULL AND rotation_deg IS NULL)
    OR (page_index IS NOT NULL AND position_x IS NOT NULL AND position_y IS NOT NULL AND rotation_deg IS NOT NULL
      AND page_index BETWEEN 0 AND 99 AND position_x BETWEEN 0 AND 1
      AND position_y BETWEEN 0 AND 1 AND rotation_deg BETWEEN -180 AND 180)
  );
ALTER TABLE public.stamp_book_stamp_requests
  ADD CONSTRAINT stamp_book_requests_scale_factor_check
  CHECK (scale_factor IS NULL OR scale_factor BETWEEN 0.4 AND 2.5);
ALTER TABLE public.stamp_book_marks
  ADD CONSTRAINT stamp_book_marks_scale_factor_check
  CHECK (scale_factor IS NULL OR scale_factor BETWEEN 0.4 AND 2.5);

-- The approval path uses the existing BEFORE INSERT trigger. Keep the metadata
-- together, including the scale selected by the giver, when a pending request is approved.
CREATE OR REPLACE FUNCTION pointplus_private.book_copy_paper_position()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF NEW.page_index IS NULL THEN
    SELECT r.page_index, r.position_x, r.position_y, r.rotation_deg, r.scale_factor
    INTO NEW.page_index, NEW.position_x, NEW.position_y, NEW.rotation_deg, NEW.scale_factor
    FROM public.stamp_book_stamp_requests r WHERE r.id=NEW.request_id;
  END IF;
  RETURN NEW;
END $function$;

-- Retain the exact existing RPC signature and guards. Only widen its angle range
-- from +/-15 degrees to the full +/-180-degree circle.
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
  v_cycle_target integer;
BEGIN
  IF auth.uid() IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Authentication/idempotency key required';
  END IF;
  -- Serialize all placement and replay checks on the same book lock.
  SELECT * INTO v_book FROM public.stamp_books WHERE id = p_book FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.space_members m
      WHERE m.space_id=v_book.space_id AND m.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Room membership required';
  END IF;
  -- Replays of the final stamp must still succeed after the cycle completes
  -- or after Couple memory redemption archives the book. No new mark is made.
  SELECT * INTO v_prior FROM public.stamp_book_stamp_requests
    WHERE book_id = p_book AND giver_user_id = auth.uid() AND idempotency_key = p_key;
  IF FOUND THEN
    IF v_prior.participant_id IS DISTINCT FROM p_recipient
       OR v_prior.asset_id IS DISTINCT FROM p_art
       OR v_prior.note IS DISTINCT FROM p_note
       OR v_prior.page_index IS DISTINCT FROM p_page
       OR v_prior.position_x IS DISTINCT FROM p_x
       OR v_prior.position_y IS DISTINCT FROM p_y
       OR v_prior.rotation_deg IS DISTINCT FROM p_rotation
    THEN RAISE EXCEPTION 'Idempotency key already used with different content'; END IF;
    RETURN jsonb_build_object('request_id', v_prior.id, 'status', v_prior.status);
  END IF;

  SELECT c.target_snapshot INTO v_cycle_target
  FROM public.stamp_book_cycles c
  WHERE c.book_id = p_book AND c.participant_id = p_recipient
    AND c.completed_at IS NULL AND c.progress_count < c.target_snapshot
  ORDER BY c.cycle_no DESC LIMIT 1;
  IF v_cycle_target IS NULL THEN RAISE EXCEPTION 'No open collection cycle'; END IF;
  v_max_page := CASE WHEN v_book.layout_mode = 'single_sheet'
    THEN 0 ELSE (v_cycle_target - 1) / 6 END;
  IF p_page IS NULL OR p_page NOT BETWEEN 0 AND v_max_page
    OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1
    OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
    OR p_rotation IS NULL OR p_rotation NOT BETWEEN -180 AND 180
  THEN RAISE EXCEPTION 'Invalid stamp placement coordinates'; END IF;

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


-- A separate, versioned RPC prevents ambiguity and retains support for older
-- paper clients that only send x/y/rotation without scale_factor.
CREATE FUNCTION public.pointplus_give_stamp_freely(
  p_book uuid, p_recipient uuid, p_art text, p_note text, p_key uuid,
  p_page integer, p_x numeric, p_y numeric, p_rotation numeric, p_scale numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_book public.stamp_books%ROWTYPE;
  v_prior public.stamp_book_stamp_requests%ROWTYPE;
  v_result jsonb;
  v_request uuid;
BEGIN
  IF auth.uid() IS NULL OR p_key IS NULL OR p_scale IS NULL OR p_scale NOT BETWEEN 0.4 AND 2.5 THEN
    RAISE EXCEPTION 'Invalid authentication, idempotency key, or stamp scale';
  END IF;
  -- Serialize concurrent requests before checking scale-specific idempotency.
  SELECT * INTO v_book FROM public.stamp_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.space_members m
    WHERE m.space_id=v_book.space_id AND m.user_id=auth.uid())
  THEN RAISE EXCEPTION 'Room membership required'; END IF;

  SELECT * INTO v_prior FROM public.stamp_book_stamp_requests
    WHERE book_id=p_book AND giver_user_id=auth.uid() AND idempotency_key=p_key;
  IF FOUND AND v_prior.scale_factor IS DISTINCT FROM p_scale THEN
    RAISE EXCEPTION 'Idempotency key reused with different stamp size';
  END IF;

  v_result := public.pointplus_give_stamp_at(
    p_book,p_recipient,p_art,p_note,p_key,p_page,p_x,p_y,p_rotation);
  v_request := (v_result->>'request_id')::uuid;
  IF v_request IS NULL THEN RAISE EXCEPTION 'Missing stamp request receipt'; END IF;
  IF v_prior.id IS NULL THEN
    -- The placement RPC already inserted an authorized and idempotent request.
    -- Scale is written in the same transaction as its approved mark (if any).
    UPDATE public.stamp_book_stamp_requests
      SET scale_factor=p_scale WHERE id=v_request;
    UPDATE public.stamp_book_marks
      SET scale_factor=p_scale WHERE request_id=v_request;
  END IF;
  RETURN v_result;
END $function$;

REVOKE ALL ON FUNCTION public.pointplus_give_stamp_freely(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_give_stamp_freely(uuid,uuid,text,text,uuid,integer,numeric,numeric,numeric,numeric)
  TO authenticated;

COMMIT;
