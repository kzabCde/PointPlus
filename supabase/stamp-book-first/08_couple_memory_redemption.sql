-- Couple Memories v1.2. Target: PointPlus gczribbtkfvhpzzupqre.
-- Non-destructive; never replay baseline 01 or previous 06 migrations.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='120s';
DO $preflight$
BEGIN
 IF to_regclass('public.stamp_book_claims') IS NULL
 OR to_regclass('public.stamp_book_cycles') IS NULL
 OR to_regprocedure('pointplus_private.book_can_edit(uuid,uuid)') IS NULL
 OR to_regprocedure('public.pointplus_claim_couple_memory(uuid,text,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'Couple Memories baseline missing or already applied'; END IF;
END $preflight$;

-- Do not open new automatic repeat cycles for couple books. Other kinds unchanged.
CREATE OR REPLACE FUNCTION pointplus_private.book_apply_stamp(p_request uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE req public.stamp_book_stamp_requests%ROWTYPE;
 book public.stamp_books%ROWTYPE; cyc public.stamp_book_cycles%ROWTYPE;
 v_mark uuid;
BEGIN
 SELECT * INTO req FROM public.stamp_book_stamp_requests WHERE id=p_request;
 IF NOT FOUND OR req.status<>'approved' THEN RAISE EXCEPTION 'Stamp request not approved'; END IF;
 SELECT id INTO v_mark FROM public.stamp_book_marks WHERE request_id=p_request;
 IF FOUND THEN RETURN v_mark; END IF;
 SELECT * INTO book FROM public.stamp_books WHERE id=req.book_id FOR UPDATE;
 IF book.id IS NULL OR book.status<>'active' THEN RAISE EXCEPTION 'Book no longer accepts stamps'; END IF;
 SELECT * INTO cyc FROM public.stamp_book_cycles WHERE book_id=req.book_id
   AND participant_id=req.participant_id ORDER BY cycle_no DESC LIMIT 1 FOR UPDATE;
 IF cyc.id IS NULL OR cyc.completed_at IS NOT NULL OR cyc.progress_count>=cyc.target_snapshot THEN
   RAISE EXCEPTION 'No open collection cycle'; END IF;
 INSERT INTO public.stamp_book_marks(request_id,cycle_id,book_id,participant_id,space_id,
   asset_id,giver_user_id,approved_by,note)
 VALUES(req.id,cyc.id,req.book_id,req.participant_id,req.space_id,
        req.asset_id,req.giver_user_id,req.reviewed_by,req.note)
 RETURNING id INTO v_mark;
 UPDATE public.stamp_book_cycles
 SET progress_count=progress_count+1,
 completed_at=CASE WHEN progress_count+1>=target_snapshot THEN now() ELSE NULL END
 WHERE id=cyc.id;
 IF cyc.progress_count+1=cyc.target_snapshot AND book.repeatable AND NOT EXISTS (
  SELECT 1 FROM public.spaces s WHERE s.id=book.space_id AND s.kind='couple'
 ) THEN
  INSERT INTO public.stamp_book_cycles(book_id,participant_id,space_id,cycle_no,target_snapshot)
  VALUES(book.id,cyc.participant_id,book.space_id,cyc.cycle_no+1,book.target_count);
 END IF;
 RETURN v_mark;
END $function$


-- Prevent legacy fixed-option redemption from bypassing a Couple memory message.
CREATE OR REPLACE FUNCTION public.pointplus_claim_stamp_book_reward(p_cycle uuid, p_reward uuid, p_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid(); cyc public.stamp_book_cycles%ROWTYPE;
 rw public.stamp_book_reward_options%ROWTYPE; v_claim uuid; existing public.stamp_book_claims%ROWTYPE;
BEGIN
 -- A Couple Book can only be redeemed through the typed-memory flow.
 IF EXISTS(SELECT 1 FROM public.stamp_book_cycles c
    JOIN public.spaces s ON s.id=c.space_id
    WHERE c.id=p_cycle AND s.kind='couple') THEN
    RAISE EXCEPTION 'Couple memory rewards require a message';
 END IF;
 IF v_uid IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Authentication/idempotency key required'; END IF;
 SELECT * INTO cyc FROM public.stamp_book_cycles WHERE id=p_cycle FOR UPDATE;
 IF NOT FOUND OR cyc.completed_at IS NULL OR cyc.progress_count<>cyc.target_snapshot OR
 NOT pointplus_private.book_can_claim(cyc.space_id,cyc.participant_id,v_uid) THEN
   RAISE EXCEPTION 'Not eligible to choose a Book reward'; END IF;
 SELECT * INTO existing FROM public.stamp_book_claims WHERE cycle_id=p_cycle;
 IF FOUND THEN
   IF existing.claimed_by=v_uid AND existing.reward_option_id=p_reward
   AND existing.idempotency_key=p_key THEN RETURN existing.id; END IF;
   RAISE EXCEPTION 'This completed Book was already claimed';
 END IF;
 SELECT * INTO rw FROM public.stamp_book_reward_options WHERE id=p_reward FOR UPDATE;
 IF NOT FOUND OR rw.book_id<>cyc.book_id OR rw.space_id<>cyc.space_id OR
  NOT rw.active OR rw.stock_remaining=0 THEN RAISE EXCEPTION 'Reward unavailable for this Book'; END IF;
 IF rw.stock_remaining IS NOT NULL THEN
 UPDATE public.stamp_book_reward_options SET stock_remaining=stock_remaining-1 WHERE id=rw.id;
 END IF;
 INSERT INTO public.stamp_book_claims(cycle_id,book_id,participant_id,space_id,
 reward_option_id,reward_title_snapshot,claimed_by,idempotency_key)
 VALUES(cyc.id,cyc.book_id,cyc.participant_id,cyc.space_id,
 rw.id,rw.title,v_uid,p_key) RETURNING id INTO v_claim;
 RETURN v_claim;
END $function$


-- Recipient enters a free-text reward and archives the completed book.
-- Exactly one claim per cycle; immutable message snapshot and all stamps retained.
-- Locks order: book first, then cycle (same order as stamp issuance).
CREATE FUNCTION public.pointplus_claim_couple_memory(
 p_cycle uuid, p_message text, p_key uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_text text;
 v_book public.stamp_books%ROWTYPE;
 v_cycle public.stamp_book_cycles%ROWTYPE;
 v_prior public.stamp_book_claims%ROWTYPE;
 v_option uuid; v_claim uuid;
BEGIN
 IF v_uid IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 v_text:=btrim(coalesce(p_message,''));
 IF length(v_text) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'Reward message must be 1-1000 characters'; END IF;

 SELECT b.* INTO v_book FROM public.stamp_book_cycles c
 JOIN public.stamp_books b ON b.id=c.book_id
 WHERE c.id=p_cycle FOR UPDATE OF b;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM public.spaces s WHERE s.id=v_book.space_id AND s.kind='couple'
 ) THEN RAISE EXCEPTION 'Not a Couple Stamp Book'; END IF;
 IF NOT pointplus_private.book_can_claim(v_book.space_id,
    (SELECT c.participant_id FROM public.stamp_book_cycles c WHERE c.id=p_cycle),v_uid)
 THEN RAISE EXCEPTION 'Only the recipient may redeem'; END IF;

 SELECT * INTO v_prior FROM public.stamp_book_claims WHERE cycle_id=p_cycle;
 IF FOUND THEN
   IF v_prior.claimed_by=v_uid AND v_prior.idempotency_key=p_key
      AND v_prior.reward_title_snapshot=v_text THEN RETURN v_prior.id; END IF;
   RAISE EXCEPTION 'Book reward already claimed'; END IF;

 IF v_book.status<>'active' THEN RAISE EXCEPTION 'Book not active'; END IF;
 SELECT * INTO v_cycle FROM public.stamp_book_cycles
 WHERE id=p_cycle AND book_id=v_book.id FOR UPDATE;
 IF NOT FOUND OR v_cycle.completed_at IS NULL
     OR v_cycle.progress_count<>v_cycle.target_snapshot
 THEN RAISE EXCEPTION 'Book is not complete'; END IF;

 -- FK-compatible one-off reward option, with complete free-text snapshot on claim.
 INSERT INTO public.stamp_book_reward_options(book_id,space_id,title,description,active)
 VALUES(v_book.id,v_book.space_id,left(v_text,160),NULL,false)
 RETURNING id INTO v_option;
 INSERT INTO public.stamp_book_claims(
   cycle_id,book_id,participant_id,space_id,reward_option_id,
   reward_title_snapshot,claimed_by,idempotency_key,status
 ) VALUES(v_cycle.id,v_book.id,v_cycle.participant_id,v_book.space_id,
          v_option,v_text,v_uid,p_key,'requested')
 RETURNING id INTO v_claim;
 UPDATE public.stamp_books SET status='archived',repeatable=false,updated_at=now()
 WHERE id=v_book.id;
 RETURN v_claim;
END $$;
REVOKE ALL ON FUNCTION public.pointplus_claim_couple_memory(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_claim_couple_memory(uuid,text,uuid)
 TO authenticated;
COMMIT;
