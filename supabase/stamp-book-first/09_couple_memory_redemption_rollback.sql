-- Pause Couple Memories v1.2 without removing memories or historic claims.
-- Existing archived books remain archived, the new API stops accepting writes.
BEGIN;
SET LOCAL lock_timeout='8s';
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
 IF cyc.progress_count+1=cyc.target_snapshot AND book.repeatable THEN
  INSERT INTO public.stamp_book_cycles(book_id,participant_id,space_id,cycle_no,target_snapshot)
  VALUES(book.id,cyc.participant_id,book.space_id,cyc.cycle_no+1,book.target_count);
 END IF;
 RETURN v_mark;
END $function$;

CREATE OR REPLACE FUNCTION public.pointplus_claim_stamp_book_reward(p_cycle uuid, p_reward uuid, p_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=auth.uid(); cyc public.stamp_book_cycles%ROWTYPE;
 rw public.stamp_book_reward_options%ROWTYPE; v_claim uuid; existing public.stamp_book_claims%ROWTYPE;
BEGIN
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
END $function$;

REVOKE EXECUTE ON FUNCTION public.pointplus_claim_couple_memory(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
COMMIT;
