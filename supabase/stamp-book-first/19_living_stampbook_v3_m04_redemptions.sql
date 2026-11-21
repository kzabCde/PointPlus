-- POINT+ Living Stampbook V3 — M04 Flexible Redemption
-- Additive, apply AFTER M01(16), M02(17), M03(18) in a disposable database.
-- DO NOT RUN IN PRODUCTION prior to explicit M01–M05 release authorization.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='120s';

DO $m04_preflight$
BEGIN
 IF to_regclass('public.living_stamp_marks') IS NULL
   OR to_regclass('public.living_stamp_events') IS NULL
   OR to_regclass('public.living_books') IS NULL
   OR to_regclass('public.living_stamp_requests') IS NULL
 THEN RAISE EXCEPTION 'M03 must be installed before M04'; END IF;
 IF to_regclass('public.living_stamp_redemptions') IS NOT NULL
 THEN RAISE EXCEPTION 'M04 already installed; do not replay'; END IF;
END $m04_preflight$;

CREATE TABLE public.living_stamp_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL,
 space_id uuid NOT NULL,
 recipient_participant_id uuid NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 requested_quantity integer NOT NULL CHECK(requested_quantity > 0),
 reward_message text NOT NULL CHECK(length(btrim(reward_message)) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'requested'
   CHECK(status IN ('requested','fulfilled','canceled')),
 idempotency_key uuid NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 fulfilled_at timestamptz,
 fulfilled_by uuid REFERENCES auth.users(id),
 canceled_at timestamptz,
 canceled_by uuid REFERENCES auth.users(id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(book_id,recipient_participant_id) REFERENCES public.living_books(id,recipient_participant_id),
 UNIQUE(id,book_id),
 UNIQUE(book_id,requested_by,idempotency_key),
 CONSTRAINT living_stamp_redemptions_state_check CHECK(
   (status='requested' AND fulfilled_at IS NULL AND fulfilled_by IS NULL
      AND canceled_at IS NULL AND canceled_by IS NULL)
   OR
   (status='fulfilled' AND fulfilled_at IS NOT NULL AND fulfilled_by IS NOT NULL
      AND canceled_at IS NULL AND canceled_by IS NULL)
   OR
   (status='canceled' AND canceled_at IS NOT NULL AND canceled_by IS NOT NULL
      AND fulfilled_at IS NULL AND fulfilled_by IS NULL)
 )
);
CREATE INDEX living_stamp_redemptions_book_recent_idx
 ON public.living_stamp_redemptions(book_id,requested_at DESC,id);
CREATE INDEX living_stamp_redemptions_open_idx
 ON public.living_stamp_redemptions(book_id,requested_at)
 WHERE status='requested';

-- Preserve redeemed stamp UUIDs and the exact stamp association for every request,
-- including canceled requests. Canceled marks may be reserved again for a NEW request;
-- historical associations are never deleted.
ALTER TABLE public.living_stamp_marks ADD CONSTRAINT living_stamp_marks_book_id_pair UNIQUE(book_id,id);

CREATE TABLE public.living_stamp_redemption_marks (
 redemption_id uuid NOT NULL,
 book_id uuid NOT NULL,
 mark_id uuid NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(redemption_id,mark_id),
 FOREIGN KEY(redemption_id,book_id)
   REFERENCES public.living_stamp_redemptions(id,book_id) ON DELETE RESTRICT,
 FOREIGN KEY(book_id,mark_id)
   REFERENCES public.living_stamp_marks(book_id,id) ON DELETE RESTRICT
);
CREATE INDEX living_stamp_redemption_marks_mark_idx
 ON public.living_stamp_redemption_marks(mark_id,redemption_id);
ALTER TABLE public.living_stamp_marks
 ADD COLUMN redemption_id uuid,
 ADD COLUMN reserved_at timestamptz,
 ADD COLUMN redeemed_at timestamptz;
ALTER TABLE public.living_stamp_marks
 ADD CONSTRAINT living_stamp_marks_redemption_book_fkey
 FOREIGN KEY(redemption_id,book_id)
 REFERENCES public.living_stamp_redemptions(id,book_id) ON DELETE RESTRICT;

-- The M03 unnamed CHECK constraints have stable PostgreSQL generated names.
-- Replace both to allow exactly four states without weakening peel or usage history.
ALTER TABLE public.living_stamp_marks
 DROP CONSTRAINT living_stamp_marks_state_check,
 DROP CONSTRAINT living_stamp_marks_check;
ALTER TABLE public.living_stamp_marks
 ADD CONSTRAINT living_stamp_marks_state_check
 CHECK(state IN('available','peeled','reserved','redeemed')),
 ADD CONSTRAINT living_stamp_marks_lifecycle_check CHECK(
   (state='available' AND peeled_at IS NULL AND peeled_by IS NULL
       AND reserved_at IS NULL AND redeemed_at IS NULL AND redemption_id IS NULL)
   OR
   (state='peeled' AND peeled_at IS NOT NULL AND peeled_by IS NOT NULL
       AND reserved_at IS NULL AND redeemed_at IS NULL AND redemption_id IS NULL)
   OR
   (state='reserved' AND peeled_at IS NULL AND peeled_by IS NULL
       AND reserved_at IS NOT NULL AND redeemed_at IS NULL AND redemption_id IS NOT NULL)
   OR
   (state='redeemed' AND peeled_at IS NULL AND peeled_by IS NULL
       AND reserved_at IS NOT NULL AND redeemed_at IS NOT NULL AND redemption_id IS NOT NULL)
 );
CREATE INDEX living_stamp_marks_reservation_idx
 ON public.living_stamp_marks(book_id,redemption_id)
 WHERE state='reserved';

ALTER TABLE public.living_stamp_events
 DROP CONSTRAINT living_stamp_events_event_type_check;
ALTER TABLE public.living_stamp_events
 ADD CONSTRAINT living_stamp_events_event_type_check
 CHECK(event_type IN('granted','transformed','peeled','reserved','redeemed','released'));

ALTER TABLE public.living_stamp_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_stamp_redemption_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.living_stamp_redemptions,public.living_stamp_redemption_marks
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.living_stamp_redemptions,public.living_stamp_redemption_marks
 TO authenticated;

CREATE POLICY living_redemptions_room_member_read_m04 ON public.living_stamp_redemptions
 FOR SELECT TO authenticated USING (EXISTS(
   SELECT 1 FROM public.space_members m
   WHERE m.space_id=living_stamp_redemptions.space_id
     AND m.user_id=(SELECT auth.uid())
 ));
CREATE POLICY living_redemption_marks_room_member_read_m04
 ON public.living_stamp_redemption_marks
 FOR SELECT TO authenticated USING (EXISTS(
   SELECT 1 FROM public.living_books b
   JOIN public.space_members m ON m.space_id=b.space_id
   WHERE b.id=living_stamp_redemption_marks.book_id
     AND m.user_id=(SELECT auth.uid())
 ));

-- The existing M03 stamp-transform and peel RPCs already reject any state other
-- than available. They lock the same book row, so M04 reservations cannot race
-- with transforms, peeling, approvals or grants.
CREATE FUNCTION public.pointplus_request_living_stamp_redemption(
 p_book uuid,p_quantity integer,p_reward_message text,p_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_book public.living_books%ROWTYPE;
 v_recipient public.participants%ROWTYPE;
 v_existing public.living_stamp_redemptions%ROWTYPE;
 v_redemption_id uuid;
 v_mark_ids uuid[];
 v_count integer;
 v_item uuid;
BEGIN
 IF v_uid IS NULL OR p_book IS NULL OR p_key IS NULL
   OR p_quantity IS NULL OR p_quantity<1
   OR p_reward_message IS NULL OR length(btrim(p_reward_message)) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'Invalid redemption request' USING ERRCODE='22023'; END IF;

 -- Single per-book serialization point, shared with the M03 stamp mutations.
 SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM public.space_members m
   WHERE m.space_id=v_book.space_id AND m.user_id=v_uid
 ) THEN RAISE EXCEPTION 'Not a member of this Living Book' USING ERRCODE='42501'; END IF;

 SELECT * INTO v_recipient FROM public.participants p
 WHERE p.id=v_book.recipient_participant_id AND p.space_id=v_book.space_id
   AND p.archived_at IS NULL;
 IF NOT FOUND OR v_uid=v_book.owner_user_id
   OR NOT (
     v_recipient.user_id=v_uid
     OR (v_recipient.user_id IS NULL AND v_recipient.kind='child'
         AND v_recipient.guardian_user_id=v_uid)
   )
 THEN RAISE EXCEPTION 'Only the receiving partner or child guardian can redeem'
   USING ERRCODE='42501'; END IF;

 SELECT * INTO v_existing FROM public.living_stamp_redemptions r
 WHERE r.book_id=p_book AND r.requested_by=v_uid AND r.idempotency_key=p_key;
 IF FOUND THEN
   IF v_existing.requested_quantity<>p_quantity
      OR v_existing.reward_message<>btrim(p_reward_message)
   THEN RAISE EXCEPTION 'Idempotency key reused with different redemption details'
      USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object(
     'id',v_existing.id,'status',v_existing.status,
     'quantity',v_existing.requested_quantity,
     'mark_ids',(SELECT coalesce(jsonb_agg(a.mark_id ORDER BY a.linked_at,a.mark_id),'[]'::jsonb)
       FROM public.living_stamp_redemption_marks a WHERE a.redemption_id=v_existing.id));
 END IF;
 IF v_book.status<>'active'
 THEN RAISE EXCEPTION 'Living Book is not active' USING ERRCODE='22023'; END IF;

 -- Earliest earned eligible stamps are selected deterministically.
 -- Lock precisely the candidates; if too few exist, the full transaction rolls back.
 SELECT array_agg(p.id ORDER BY p.granted_at,p.id) INTO v_mark_ids
 FROM (
   SELECT s.id,s.granted_at FROM public.living_stamp_marks s
   WHERE s.book_id=p_book AND s.recipient_participant_id=v_book.recipient_participant_id
     AND s.state='available'
   ORDER BY s.granted_at,s.id
   LIMIT p_quantity
   FOR UPDATE
 ) p;
 v_count:=coalesce(array_length(v_mark_ids,1),0);
 IF v_count<>p_quantity
 THEN RAISE EXCEPTION 'Not enough available stamps' USING ERRCODE='22023'; END IF;

 INSERT INTO public.living_stamp_redemptions(
  book_id,space_id,recipient_participant_id,requested_by,
  requested_quantity,reward_message,status,idempotency_key
 ) VALUES(
  p_book,v_book.space_id,v_book.recipient_participant_id,v_uid,
  p_quantity,btrim(p_reward_message),'requested',p_key
 ) RETURNING id INTO v_redemption_id;

 UPDATE public.living_stamp_marks
 SET state='reserved',redemption_id=v_redemption_id,
     reserved_at=now(),version=version+1
 WHERE id=ANY(v_mark_ids) AND book_id=p_book AND state='available';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>p_quantity
 THEN RAISE EXCEPTION 'Concurrent reservation conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO public.living_stamp_redemption_marks(redemption_id,book_id,mark_id)
 SELECT v_redemption_id,p_book,unnest(v_mark_ids);
 INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id,details)
 SELECT p_book,m.id,'reserved',v_uid,
   jsonb_build_object('redemption_id',v_redemption_id)
 FROM public.living_stamp_marks m WHERE m.id=ANY(v_mark_ids);
 RETURN jsonb_build_object('id',v_redemption_id,'status','requested',
   'quantity',p_quantity,'mark_ids',to_jsonb(v_mark_ids));
END $fn$;

CREATE FUNCTION public.pointplus_fulfill_living_stamp_redemption(p_redemption uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_request public.living_stamp_redemptions%ROWTYPE;
 v_book public.living_books%ROWTYPE;
 v_count integer;
 v_ids uuid[];
BEGIN
 IF v_uid IS NULL OR p_redemption IS NULL
 THEN RAISE EXCEPTION 'Authentication and redemption id required'
   USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_redemptions WHERE id=p_redemption;
 IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_request.book_id FOR UPDATE;
 IF NOT FOUND OR v_uid<>v_book.owner_user_id OR
   NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Only the book owner may fulfill' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_redemptions
 WHERE id=p_redemption FOR UPDATE;
 IF v_request.status='fulfilled' THEN
   RETURN jsonb_build_object('id',p_redemption,'status','fulfilled',
     'quantity',v_request.requested_quantity);
 END IF;
 IF v_request.status<>'requested' OR v_book.status='archived'
 THEN RAISE EXCEPTION 'Redemption is not open for fulfillment' USING ERRCODE='22023'; END IF;

 SELECT array_agg(s.id ORDER BY s.granted_at,s.id) INTO v_ids
 FROM (
   SELECT id,granted_at FROM public.living_stamp_marks
   WHERE book_id=v_request.book_id AND redemption_id=p_redemption
     AND state='reserved'
   ORDER BY granted_at,id FOR UPDATE
 ) s;
 v_count:=coalesce(array_length(v_ids,1),0);
 IF v_count<>v_request.requested_quantity OR EXISTS(
   SELECT 1 FROM public.living_stamp_redemption_marks a
   WHERE a.redemption_id=p_redemption AND NOT (a.mark_id=ANY(v_ids))
 ) THEN RAISE EXCEPTION 'Inconsistent stamp reservation' USING ERRCODE='40001'; END IF;

 UPDATE public.living_stamp_marks
 SET state='redeemed',redeemed_at=now(),version=version+1
 WHERE book_id=v_request.book_id AND redemption_id=p_redemption AND state='reserved';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_request.requested_quantity
 THEN RAISE EXCEPTION 'Redemption changed before fulfillment' USING ERRCODE='40001'; END IF;
 UPDATE public.living_stamp_redemptions
 SET status='fulfilled',fulfilled_at=now(),fulfilled_by=v_uid
 WHERE id=p_redemption;
 INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id,details)
 SELECT v_request.book_id,id,'redeemed',v_uid,
   jsonb_build_object('redemption_id',p_redemption)
 FROM public.living_stamp_marks WHERE id=ANY(v_ids);
 RETURN jsonb_build_object('id',p_redemption,'status','fulfilled',
   'quantity',v_request.requested_quantity);
END $fn$;

CREATE FUNCTION public.pointplus_cancel_living_stamp_redemption(p_redemption uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_request public.living_stamp_redemptions%ROWTYPE;
 v_book public.living_books%ROWTYPE;
 v_count integer;
 v_ids uuid[];
BEGIN
 IF v_uid IS NULL OR p_redemption IS NULL
 THEN RAISE EXCEPTION 'Authentication and redemption id required'
   USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_redemptions WHERE id=p_redemption;
 IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_request.book_id FOR UPDATE;
 IF NOT FOUND OR v_uid<>v_book.owner_user_id OR
   NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Only the book owner may cancel' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_redemptions
 WHERE id=p_redemption FOR UPDATE;
 IF v_request.status='canceled' THEN
   RETURN jsonb_build_object('id',p_redemption,'status','canceled',
     'quantity',v_request.requested_quantity);
 END IF;
 IF v_request.status<>'requested'
 THEN RAISE EXCEPTION 'Redemption cannot be canceled' USING ERRCODE='22023'; END IF;

 SELECT array_agg(s.id ORDER BY s.granted_at,s.id) INTO v_ids
 FROM (
   SELECT id,granted_at FROM public.living_stamp_marks
   WHERE book_id=v_request.book_id AND redemption_id=p_redemption
     AND state='reserved'
   ORDER BY granted_at,id FOR UPDATE
 ) s;
 v_count:=coalesce(array_length(v_ids,1),0);
 IF v_count<>v_request.requested_quantity OR EXISTS(
   SELECT 1 FROM public.living_stamp_redemption_marks a
   WHERE a.redemption_id=p_redemption AND NOT (a.mark_id=ANY(v_ids))
 ) THEN RAISE EXCEPTION 'Inconsistent stamp reservation' USING ERRCODE='40001'; END IF;

 UPDATE public.living_stamp_marks
 SET state='available',redemption_id=NULL,reserved_at=NULL,version=version+1
 WHERE book_id=v_request.book_id AND redemption_id=p_redemption AND state='reserved';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_request.requested_quantity
 THEN RAISE EXCEPTION 'Reservation changed before cancellation' USING ERRCODE='40001'; END IF;
 UPDATE public.living_stamp_redemptions
 SET status='canceled',canceled_at=now(),canceled_by=v_uid
 WHERE id=p_redemption;
 INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id,details)
 SELECT v_request.book_id,unnest(v_ids),'released',v_uid,
   jsonb_build_object('redemption_id',p_redemption);
 RETURN jsonb_build_object('id',p_redemption,'status','canceled',
   'quantity',v_request.requested_quantity);
END $fn$;

CREATE FUNCTION public.pointplus_get_living_stamp_balance(p_book uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 v_uid uuid:=auth.uid();
 v_book public.living_books%ROWTYPE;
 v_total bigint;
 v_available bigint;
 v_reserved bigint;
 v_redeemed bigint;
 v_peeled bigint;
BEGIN
 IF v_uid IS NULL OR p_book IS NULL
 THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_book FROM public.living_books b WHERE b.id=p_book;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.space_members m
    WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'No access to Living Book' USING ERRCODE='42501'; END IF;
 SELECT count(*),
   count(*) FILTER(WHERE state='available'),
   count(*) FILTER(WHERE state='reserved'),
   count(*) FILTER(WHERE state='redeemed'),
   count(*) FILTER(WHERE state='peeled')
 INTO v_total,v_available,v_reserved,v_redeemed,v_peeled
 FROM public.living_stamp_marks WHERE book_id=p_book;
 RETURN jsonb_build_object('total',v_total,'available',v_available,
   'reserved',v_reserved,'redeemed',v_redeemed,'peeled',v_peeled);
END $fn$;

REVOKE ALL ON FUNCTION public.pointplus_request_living_stamp_redemption(
  uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_fulfill_living_stamp_redemption(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_cancel_living_stamp_redemption(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_get_living_stamp_balance(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_request_living_stamp_redemption(
  uuid,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_fulfill_living_stamp_redemption(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_cancel_living_stamp_redemption(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_get_living_stamp_balance(uuid)
  TO authenticated;
COMMIT;
