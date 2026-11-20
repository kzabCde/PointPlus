-- PointPlus v2.3: explicit numbered slot placement on Stamp Cards.
-- Additive to the live v2.2 stamp_card format; no change to notebook placement.
-- Direct and approval-required issuance stay inside the original guarded stamp RPC.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.stamp_books') IS NULL
    OR to_regclass('public.stamp_book_marks') IS NULL
    OR to_regclass('public.stamp_book_stamp_requests') IS NULL
    OR to_regprocedure('public.pointplus_give_stamp(uuid,uuid,text,text,uuid)') IS NULL
    OR to_regprocedure('pointplus_private.book_apply_stamp(uuid)') IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.stamp_books'::regclass
        AND conname='stamp_books_layout_mode_check'
        AND pg_get_constraintdef(oid) LIKE '%stamp_card%'
    )
  THEN RAISE EXCEPTION 'PointPlus stamp card v2.2 baseline not installed'; END IF;
END $preflight$;

ALTER TABLE public.stamp_book_stamp_requests
  ADD COLUMN IF NOT EXISTS slot_index integer;
ALTER TABLE public.stamp_book_marks
  ADD COLUMN IF NOT EXISTS slot_index integer;

ALTER TABLE public.stamp_book_stamp_requests
  ADD CONSTRAINT stamp_book_request_slot_index_check
  CHECK (slot_index IS NULL OR slot_index BETWEEN 0 AND 99);
ALTER TABLE public.stamp_book_marks
  ADD CONSTRAINT stamp_book_mark_slot_index_check
  CHECK (slot_index IS NULL OR slot_index BETWEEN 0 AND 99);

-- Only one confirmed stamp may own a numbered slot within a collection cycle.
-- Multiple legacy stamps without slot metadata retain their original order.
CREATE UNIQUE INDEX stamp_book_marks_unique_card_slot
  ON public.stamp_book_marks (cycle_id, slot_index)
  WHERE slot_index IS NOT NULL;

-- Do not allow two unapproved requests to reserve the same card slot.
-- Requests are scoped to book and recipient; a new cycle cannot open until
-- the current one is completed by the existing server-side contract.
CREATE UNIQUE INDEX stamp_book_requests_pending_card_slot
  ON public.stamp_book_stamp_requests (book_id, participant_id, slot_index)
  WHERE status='pending' AND slot_index IS NOT NULL;

-- Existing approval RPC invokes book_apply_stamp() without any new parameters.
-- The BEFORE INSERT trigger inherits the chosen slot from its approved request.
CREATE FUNCTION pointplus_private.book_copy_card_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $body$
BEGIN
  IF NEW.slot_index IS NULL THEN
    SELECT r.slot_index INTO NEW.slot_index
    FROM public.stamp_book_stamp_requests r WHERE r.id=NEW.request_id;
  END IF;
  RETURN NEW;
END $body$;

CREATE TRIGGER pointplus_stamp_mark_card_slot
BEFORE INSERT ON public.stamp_book_marks
FOR EACH ROW EXECUTE FUNCTION pointplus_private.book_copy_card_slot();

-- Versioned RPC: all authorization, recipient eligibility, cycle and reward
-- invariants are delegated to the original pointplus_give_stamp() RPC.
CREATE FUNCTION public.pointplus_give_stamp_to_card(
  p_book uuid, p_recipient uuid, p_art text, p_note text, p_key uuid, p_slot integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE
  v_uid uuid := auth.uid();
  v_book public.stamp_books%ROWTYPE;
  v_prior public.stamp_book_stamp_requests%ROWTYPE;
  v_cycle public.stamp_book_cycles%ROWTYPE;
  v_legacy_count integer;
  v_free_before integer;
  v_receipt jsonb;
  v_request uuid;
BEGIN
  IF v_uid IS NULL OR p_key IS NULL OR p_slot IS NULL
    OR p_slot NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Authentication, idempotency key and valid card slot required';
  END IF;

  -- Serializes concurrent writes with the original issuer and approval path.
  SELECT * INTO v_book FROM public.stamp_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.layout_mode<>'stamp_card' THEN
    RAISE EXCEPTION 'Not a stamp card'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.space_members m
    WHERE m.space_id=v_book.space_id AND m.user_id=v_uid
  ) THEN RAISE EXCEPTION 'Room membership required'; END IF;

  -- A retry after the final stamp or archive returns the same receipt without
  -- creating an additional mark, but cannot change the chosen slot or artwork.
  SELECT * INTO v_prior FROM public.stamp_book_stamp_requests r
  WHERE r.book_id=p_book AND r.giver_user_id=v_uid AND r.idempotency_key=p_key;
  IF FOUND THEN
    IF v_prior.participant_id IS DISTINCT FROM p_recipient
      OR v_prior.asset_id IS DISTINCT FROM p_art
      OR v_prior.note IS DISTINCT FROM p_note
      OR v_prior.slot_index IS DISTINCT FROM p_slot THEN
      RAISE EXCEPTION 'Idempotency key already used with different card stamp';
    END IF;
    RETURN jsonb_build_object('request_id',v_prior.id,'status',v_prior.status);
  END IF;

  SELECT * INTO v_cycle FROM public.stamp_book_cycles c
  WHERE c.book_id=p_book AND c.participant_id=p_recipient
    AND c.completed_at IS NULL AND c.progress_count<c.target_snapshot
  ORDER BY c.cycle_no DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR p_slot >= v_cycle.target_snapshot THEN
    RAISE EXCEPTION 'Card has no open cycle or that slot is out of range';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.stamp_book_marks m
    WHERE m.cycle_id=v_cycle.id AND m.slot_index=p_slot
  ) OR EXISTS(
    SELECT 1 FROM public.stamp_book_stamp_requests r
    WHERE r.book_id=p_book AND r.participant_id=p_recipient
      AND r.status='pending' AND r.slot_index=p_slot
  ) THEN RAISE EXCEPTION 'Card slot is already filled or awaiting approval'; END IF;

  -- Backward compatibility: unindexed historical marks occupy the earliest
  -- unclaimed slots, while explicitly indexed marks keep their chosen cells.
  SELECT count(*) INTO v_legacy_count FROM public.stamp_book_marks m
  WHERE m.cycle_id=v_cycle.id AND m.slot_index IS NULL;
  SELECT count(*) INTO v_free_before
  FROM generate_series(0,p_slot-1) AS g(n)
  WHERE NOT EXISTS(
    SELECT 1 FROM public.stamp_book_marks m
    WHERE m.cycle_id=v_cycle.id AND m.slot_index=g.n
  );
  IF v_legacy_count > v_free_before THEN
    RAISE EXCEPTION 'Card slot is already filled by a historical stamp';
  END IF;

  -- Old issuer performs the original access checks, creates the request,
  -- increments the cycle exactly once for direct approvals and retains
  -- review-required behavior. This entire RPC is one database transaction.
  v_receipt := public.pointplus_give_stamp(p_book,p_recipient,p_art,p_note,p_key);
  v_request := (v_receipt->>'request_id')::uuid;
  IF v_request IS NULL THEN RAISE EXCEPTION 'Missing stamp request receipt'; END IF;

  UPDATE public.stamp_book_stamp_requests
    SET slot_index=p_slot WHERE id=v_request;
  -- For direct approvals, the legacy issuer already inserted the mark before
  -- slot metadata was available; attach it within the same transaction.
  UPDATE public.stamp_book_marks
    SET slot_index=p_slot WHERE request_id=v_request;
  RETURN v_receipt;
END $body$;

REVOKE ALL ON FUNCTION public.pointplus_give_stamp_to_card(
  uuid,uuid,text,text,uuid,integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_give_stamp_to_card(
  uuid,uuid,text,text,uuid,integer
) TO authenticated;

REVOKE ALL ON FUNCTION pointplus_private.book_copy_card_slot()
  FROM PUBLIC, anon, authenticated;
COMMIT;
