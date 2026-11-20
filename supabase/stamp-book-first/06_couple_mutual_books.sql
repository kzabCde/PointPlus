-- Point+ Couple Stamp Books v1.1 — non-destructive enhancement.
-- Target: gczribbtkfvhpzzupqre; BASE: 20261120032841_pointplus_stamp_book_first_schema_v1.
-- Allows both Couple Room members to create books targeting the partner.
-- Only the creator controls their book and gives its stamps (direct mode).
-- The recipient chooses the reward; both Couple members can see progress.
-- Room membership and child/family/personal restrictions remain enforced.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';
DO $preflight$
BEGIN
 IF to_regclass('public.stamp_books') IS NULL
    OR to_regclass('public.stamp_book_claims') IS NULL
    OR to_regclass('public.stamp_book_marks') IS NULL
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'pointplus_couple_stamp_book_%_read')>0
 THEN RAISE EXCEPTION 'Stamp Book v1 absent or Couple v1.1 policies already present'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION pointplus_private.book_can_edit(p_book uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stamp_books b
    JOIN public.spaces s ON s.id=b.space_id
    JOIN public.space_members m ON m.space_id=b.space_id AND m.user_id=p_user
    WHERE b.id=p_book AND (
      (s.kind='couple' AND b.created_by=p_user)
      OR (s.kind<>'couple' AND m.role IN ('owner','admin'))
    )
  );
$$;
REVOKE ALL ON FUNCTION pointplus_private.book_can_edit(uuid,uuid)
 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_create_stamp_book(
 p_space uuid, p_title text, p_description text, p_target integer,
 p_repeatable boolean, p_allow_self boolean, p_approval text,
 p_recipients uuid[], p_givers uuid[], p_styles text[], p_rewards text[]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_book uuid; v_person uuid; v_user uuid;
 v_style text; v_title text; v_count integer:=0; v_kind text;
BEGIN
 IF v_uid IS NULL OR NOT (
   pointplus_private.book_is_manager(p_space,v_uid)
   OR EXISTS (
     SELECT 1 FROM public.spaces s
     JOIN public.space_members m ON m.space_id=s.id
     WHERE s.id=p_space AND s.kind='couple' AND m.user_id=v_uid
   )
 ) THEN RAISE EXCEPTION 'Not authorized to create Stamp Books'; END IF;
 SELECT kind INTO v_kind FROM public.spaces WHERE id=p_space;
 -- In a Couple Room, the book belongs to the partner and stamps are direct.
 -- This avoids approval deadlock and prevents giving stamps to oneself.
 IF v_kind='couple' AND (
      p_approval<>'direct'
      OR coalesce(cardinality(p_recipients),0)<>1
      OR NOT EXISTS (
        SELECT 1 FROM public.participants partner
        WHERE partner.id=p_recipients[1] AND partner.space_id=p_space
          AND partner.kind='adult' AND partner.user_id IS NOT NULL
          AND partner.user_id<>v_uid AND partner.archived_at IS NULL
      )
 ) THEN RAISE EXCEPTION 'Couple Books must target the other partner and use direct stamps'; END IF;
 IF v_kind IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160
 OR p_target NOT BETWEEN 1 AND 100 OR p_approval NOT IN('direct','approval_required')
 OR coalesce(length(p_description),0)>2000
 OR coalesce(cardinality(p_recipients),0) NOT BETWEEN 1 AND 30
 OR coalesce(cardinality(p_givers),0) NOT BETWEEN 1 AND 30
 OR coalesce(cardinality(p_styles),0) NOT BETWEEN 1 AND 18
 OR coalesce(cardinality(p_rewards),0) NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Invalid Stamp Book configuration'; END IF;
 IF p_approval='approval_required' AND EXISTS (
   SELECT 1 FROM unnest(p_givers) AS giver(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.space_members m
      WHERE m.space_id=p_space AND m.role IN ('owner','admin')
        AND m.user_id<>giver.id)
 ) THEN RAISE EXCEPTION 'Approval required: every giver needs another eligible Room reviewer'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_recipients) rid
    WHERE NOT EXISTS(SELECT 1 FROM public.participants p WHERE p.id=rid
       AND p.space_id=p_space AND p.archived_at IS NULL)) OR
    EXISTS(SELECT 1 FROM unnest(p_givers) gid
    WHERE NOT EXISTS(SELECT 1 FROM public.space_members m WHERE m.user_id=gid
       AND m.space_id=p_space)) OR
    EXISTS(SELECT 1 FROM unnest(p_styles) sid
    WHERE NOT EXISTS(SELECT 1 FROM public.stamp_book_artworks a WHERE a.asset_id=sid)) OR
    EXISTS(SELECT 1 FROM unnest(p_rewards) title
    WHERE title IS NULL OR length(btrim(title)) NOT BETWEEN 1 AND 160) THEN
    RAISE EXCEPTION 'Selected recipients, givers, designs or rewards are invalid'; END IF;
 INSERT INTO public.stamp_books(space_id,created_by,title,description,target_count,repeatable,
   allow_self_stamp,approval_policy,cover_asset_id)
 VALUES(p_space,v_uid,btrim(p_title),nullif(btrim(p_description),''),
   p_target,p_repeatable,CASE WHEN v_kind='couple' THEN false ELSE p_allow_self END,p_approval,p_styles[1])
 RETURNING id INTO v_book;
 INSERT INTO public.stamp_book_recipients(book_id,participant_id,space_id)
 SELECT v_book, u.id, p_space FROM (SELECT DISTINCT unnest(p_recipients) AS id) u;
 INSERT INTO public.stamp_book_givers(book_id,user_id)
 SELECT v_book, u.id FROM (
   SELECT DISTINCT unnest(p_givers) AS id
   UNION SELECT v_uid WHERE v_kind='couple'
 ) u;
 INSERT INTO public.stamp_book_styles(book_id,asset_id)
 SELECT v_book, u.id FROM (SELECT DISTINCT unnest(p_styles) AS id) u;
 INSERT INTO public.stamp_book_reward_options(book_id,space_id,title)
 SELECT v_book,p_space,btrim(u.title) FROM unnest(p_rewards) AS u(title);
 INSERT INTO public.stamp_book_cycles(book_id,participant_id,space_id,cycle_no,target_snapshot)
 SELECT v_book, participant_id,p_space,1,p_target FROM public.stamp_book_recipients WHERE book_id=v_book;
 RETURN v_book;
END $$;

CREATE OR REPLACE FUNCTION public.pointplus_give_stamp(
 p_book uuid,p_recipient uuid,p_art text,p_note text,p_key uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); b public.stamp_books%ROWTYPE; v_request uuid;
 v_status text; prev public.stamp_book_stamp_requests%ROWTYPE; v_kind text;
BEGIN
 IF v_uid IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Authentication/idempotency key required'; END IF;
 SELECT * INTO b FROM public.stamp_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR b.status<>'active' THEN RAISE EXCEPTION 'Book is not accepting stamps'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=b.space_id AND m.user_id=v_uid) OR
 NOT (
   EXISTS(SELECT 1 FROM public.stamp_book_givers g WHERE g.book_id=p_book AND g.user_id=v_uid)
   OR (b.created_by=v_uid AND EXISTS(
      SELECT 1 FROM public.spaces s WHERE s.id=b.space_id AND s.kind='couple'))
 ) OR
 NOT EXISTS(SELECT 1 FROM public.stamp_book_recipients r WHERE r.book_id=p_book AND r.participant_id=p_recipient
  AND r.space_id=b.space_id) OR
 NOT EXISTS(SELECT 1 FROM public.participants p WHERE p.id=p_recipient AND p.space_id=b.space_id AND p.archived_at IS NULL) OR
 NOT EXISTS(SELECT 1 FROM public.stamp_book_styles s WHERE s.book_id=p_book AND s.asset_id=p_art)
 THEN RAISE EXCEPTION 'Not authorized to give this stamp'; END IF;
 SELECT kind INTO v_kind FROM public.spaces WHERE id=b.space_id;
 IF EXISTS(SELECT 1 FROM public.participants p WHERE p.id=p_recipient AND p.space_id=b.space_id
   AND p.user_id=v_uid) AND (v_kind<>'personal' OR NOT b.allow_self_stamp) THEN
   RAISE EXCEPTION 'Self-stamping is not permitted'; END IF;
 IF EXISTS(SELECT 1 FROM public.participants p WHERE p.id=p_recipient
      AND p.space_id=b.space_id AND p.kind='child'
      AND p.guardian_user_id IS DISTINCT FROM v_uid)
    AND NOT pointplus_private.book_is_manager(b.space_id,v_uid) THEN
   RAISE EXCEPTION 'Only the guardian or an authorized Room manager can stamp for a child'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stamp_book_cycles c WHERE c.book_id=p_book
   AND c.participant_id=p_recipient AND c.completed_at IS NULL
   AND c.progress_count<c.target_snapshot) THEN
   RAISE EXCEPTION 'This recipient has no open Stamp Book cycle'; END IF;
 IF coalesce(length(p_note),0)>1000 THEN RAISE EXCEPTION 'Note is too long'; END IF;
 SELECT * INTO prev FROM public.stamp_book_stamp_requests
 WHERE book_id=p_book AND giver_user_id=v_uid AND idempotency_key=p_key;
 IF FOUND THEN
   IF prev.participant_id<>p_recipient OR prev.asset_id<>p_art OR prev.note IS DISTINCT FROM p_note THEN
     RAISE EXCEPTION 'Idempotency key was used for different stamp content'; END IF;
   RETURN jsonb_build_object('request_id',prev.id,'status',prev.status);
 END IF;
 v_status:=CASE WHEN b.approval_policy='direct' THEN 'approved' ELSE 'pending' END;
 INSERT INTO public.stamp_book_stamp_requests(
  book_id,participant_id,space_id,asset_id,giver_user_id,idempotency_key,note,status,
  reviewed_by,reviewed_at)
 VALUES(p_book,p_recipient,b.space_id,p_art,v_uid,p_key,p_note,v_status,
   CASE WHEN v_status='approved' THEN v_uid ELSE NULL END,
   CASE WHEN v_status='approved' THEN now() ELSE NULL END)
 RETURNING id INTO v_request;
 IF v_status='approved' THEN PERFORM pointplus_private.book_apply_stamp(v_request); END IF;
 RETURN jsonb_build_object('request_id',v_request,'status',v_status);
END $$;

CREATE OR REPLACE FUNCTION public.pointplus_update_stamp_book(
 p_book uuid,p_title text,p_description text,p_status text,p_target integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); b public.stamp_books%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO b FROM public.stamp_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR NOT pointplus_private.book_can_edit(b.id,v_uid)
 OR b.status='archived' OR p_status NOT IN('active','paused','archived')
 OR p_target NOT BETWEEN 1 AND 100 OR p_title IS NULL
 OR length(btrim(p_title)) NOT BETWEEN 1 AND 160 OR coalesce(length(p_description),0)>2000
 THEN RAISE EXCEPTION 'Invalid Book update or insufficient permissions'; END IF;
 IF p_target<>b.target_count AND EXISTS(SELECT 1 FROM public.stamp_book_marks m WHERE m.book_id=p_book)
 THEN RAISE EXCEPTION 'Cannot change target after stamps have been issued'; END IF;
 UPDATE public.stamp_books SET title=btrim(p_title),
 description=nullif(btrim(p_description),''),status=p_status,
 target_count=p_target,updated_at=now() WHERE id=p_book;
 IF p_target<>b.target_count THEN
 UPDATE public.stamp_book_cycles SET target_snapshot=p_target WHERE book_id=p_book;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pointplus_add_stamp_book_reward(
 p_book uuid,p_title text,p_description text,p_stock integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); b public.stamp_books%ROWTYPE; v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO b FROM public.stamp_books WHERE id=p_book;
 IF NOT FOUND OR NOT pointplus_private.book_can_edit(b.id,v_uid) OR b.status='archived'
 OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160 OR
 coalesce(length(p_description),0)>2000 OR (p_stock IS NOT NULL AND p_stock<0)
 THEN RAISE EXCEPTION 'Invalid reward option'; END IF;
 INSERT INTO public.stamp_book_reward_options(book_id,space_id,title,description,stock_remaining)
 VALUES(p_book,b.space_id,btrim(p_title),nullif(btrim(p_description),''),p_stock)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pointplus_process_stamp_book_claim(p_claim uuid,p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); cl public.stamp_book_claims%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO cl FROM public.stamp_book_claims WHERE id=p_claim FOR UPDATE;
 IF NOT FOUND OR cl.status<>'requested' OR p_decision NOT IN ('fulfilled','canceled')
 OR NOT pointplus_private.book_can_edit(cl.book_id,v_uid) THEN
  RAISE EXCEPTION 'Not authorized or claim already processed'; END IF;
 UPDATE public.stamp_book_claims
 SET status=p_decision,
 fulfilled_by=CASE WHEN p_decision='fulfilled' THEN v_uid ELSE NULL END,
 fulfilled_at=CASE WHEN p_decision='fulfilled' THEN now() ELSE NULL END,
 canceled_by=CASE WHEN p_decision='canceled' THEN v_uid ELSE NULL END,
 canceled_at=CASE WHEN p_decision='canceled' THEN now() ELSE NULL END
 WHERE id=p_claim;
 -- Cancellation is terminal; entitlement is NOT reissued. Replenish reserved stock only once.
 IF p_decision='canceled' THEN
 UPDATE public.stamp_book_reward_options SET stock_remaining=stock_remaining+1
 WHERE id=cl.reward_option_id AND stock_remaining IS NOT NULL;
 END IF;
END $$;

CREATE POLICY pointplus_couple_stamp_book_recipients_read ON public.stamp_book_recipients
 FOR SELECT TO authenticated
 USING (
   pointplus_private.is_member(space_id)
   AND EXISTS(SELECT 1 FROM public.spaces s WHERE s.id=space_id AND s.kind='couple')
 );

CREATE POLICY pointplus_couple_stamp_book_cycles_read ON public.stamp_book_cycles
 FOR SELECT TO authenticated
 USING (
   pointplus_private.is_member(space_id)
   AND EXISTS(SELECT 1 FROM public.spaces s WHERE s.id=space_id AND s.kind='couple')
 );

CREATE POLICY pointplus_couple_stamp_book_stamp_requests_read ON public.stamp_book_stamp_requests
 FOR SELECT TO authenticated
 USING (
   pointplus_private.is_member(space_id)
   AND EXISTS(SELECT 1 FROM public.spaces s WHERE s.id=space_id AND s.kind='couple')
 );

CREATE POLICY pointplus_couple_stamp_book_marks_read ON public.stamp_book_marks
 FOR SELECT TO authenticated
 USING (
   pointplus_private.is_member(space_id)
   AND EXISTS(SELECT 1 FROM public.spaces s WHERE s.id=space_id AND s.kind='couple')
 );

CREATE POLICY pointplus_couple_stamp_book_claims_read ON public.stamp_book_claims
 FOR SELECT TO authenticated
 USING (
   pointplus_private.is_member(space_id)
   AND EXISTS(SELECT 1 FROM public.spaces s WHERE s.id=space_id AND s.kind='couple')
 );
COMMIT;
