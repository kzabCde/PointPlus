-- Point+ Stamp Book First, additive schema proposal (NOT APPLIED).
-- Target only gczribbtkfvhpzzupqre AFTER verified live audit & restore rehearsal.
-- v3 is already live per repository audit. NEVER rerun v2/v3 base SQL.
-- The new engine is fully independent of legacy point wallets/mission triggers.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
 IF to_regclass('public.spaces') IS NULL
 OR to_regclass('public.space_members') IS NULL
 OR to_regclass('public.participants') IS NULL THEN
 RAISE EXCEPTION 'PointPlus Room v3 foundation missing'; END IF;
 IF to_regclass('public.stamp_books') IS NOT NULL THEN
 RAISE EXCEPTION 'Stamp Book schema already exists; stop and inspect live drift'; END IF;
END $preflight$;

CREATE TABLE public.stamp_book_artworks (
 asset_id text PRIMARY KEY,
 title text NOT NULL,
 original_mode text NOT NULL
);
REVOKE ALL ON public.stamp_book_artworks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stamp_book_artworks TO authenticated;
INSERT INTO public.stamp_book_artworks(asset_id,title,original_mode) VALUES
  ('couple-heart', 'หัวใจแทนความใส่ใจ', 'couple'),
  ('couple-letter', 'ส่งข้อความดี ๆ ให้กัน', 'couple'),
  ('couple-cheers', 'ใช้เวลาคุณภาพด้วยกัน', 'couple'),
  ('couple-flowers', 'สร้างเซอร์ไพรส์เล็ก ๆ', 'couple'),
  ('couple-cake', 'ฉลองโอกาสพิเศษ', 'couple'),
  ('couple-lock', 'ดูแลและรักษาคำมั่นสัญญา', 'couple'),
  ('family-star', 'ทำภารกิจได้สำเร็จ', 'family'),
  ('family-books', 'อ่านหนังสือ', 'family'),
  ('family-home', 'ช่วยดูแลบ้าน', 'family'),
  ('family-paint', 'ทำกิจกรรมสร้างสรรค์', 'family'),
  ('family-sprout', 'เรียนรู้สิ่งใหม่', 'family'),
  ('family-bear', 'แบ่งปันและมีน้ำใจ', 'family'),
  ('personal-sunrise', 'เริ่มต้นวันตามเป้าหมาย', 'personal'),
  ('personal-dumbbell', 'ออกกำลังกาย', 'personal'),
  ('personal-open-book', 'เรียนรู้ทุกวัน', 'personal'),
  ('personal-target', 'ตั้งเป้าหมายและลงมือทำ', 'personal'),
  ('personal-mountain', 'ก้าวข้ามความท้าทาย', 'personal'),
  ('personal-trophy', 'ทำสถิติของตัวเอง', 'personal');

CREATE TABLE public.stamp_books (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 space_id uuid NOT NULL REFERENCES public.spaces(id),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 description text CHECK(description IS NULL OR length(description)<=2000),
 cover_asset_id text REFERENCES public.stamp_book_artworks(asset_id),
 target_count integer NOT NULL CHECK(target_count BETWEEN 1 AND 100),
 repeatable boolean NOT NULL DEFAULT true,
 allow_self_stamp boolean NOT NULL DEFAULT false,
 approval_policy text NOT NULL DEFAULT 'direct' CHECK(approval_policy IN ('direct','approval_required')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,space_id)
);
CREATE INDEX stamp_books_by_room ON public.stamp_books(space_id,created_at DESC);

CREATE TABLE public.stamp_book_recipients (
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 space_id uuid NOT NULL,
 PRIMARY KEY(book_id,participant_id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id)
);
CREATE INDEX stamp_book_recipient_lookup ON public.stamp_book_recipients(participant_id,book_id);

CREATE TABLE public.stamp_book_givers (
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(book_id,user_id)
);
CREATE TABLE public.stamp_book_styles (
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 asset_id text NOT NULL REFERENCES public.stamp_book_artworks(asset_id),
 PRIMARY KEY(book_id,asset_id)
);
CREATE TABLE public.stamp_book_reward_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 space_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 description text CHECK(description IS NULL OR length(description)<=2000),
 stock_remaining integer CHECK(stock_remaining IS NULL OR stock_remaining>=0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,book_id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id)
);

CREATE TABLE public.stamp_book_cycles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 space_id uuid NOT NULL,
 cycle_no integer NOT NULL CHECK(cycle_no>=1),
 target_snapshot integer NOT NULL CHECK(target_snapshot BETWEEN 1 AND 100),
 progress_count integer NOT NULL DEFAULT 0 CHECK(progress_count>=0),
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(book_id,participant_id,cycle_no),
 UNIQUE(id,book_id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id),
 CHECK(progress_count<=target_snapshot),
 CHECK((completed_at IS NOT NULL) = (progress_count=target_snapshot))
);
CREATE INDEX stamp_book_cycles_recipient ON public.stamp_book_cycles(book_id,participant_id,cycle_no DESC);

CREATE TABLE public.stamp_book_stamp_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 space_id uuid NOT NULL,
 asset_id text NOT NULL REFERENCES public.stamp_book_artworks(asset_id),
 giver_user_id uuid NOT NULL REFERENCES auth.users(id),
 idempotency_key uuid NOT NULL,
 note text CHECK(note IS NULL OR length(note)<=1000),
 status text NOT NULL CHECK(status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(book_id,giver_user_id,idempotency_key),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id),
 FOREIGN KEY(book_id,participant_id) REFERENCES public.stamp_book_recipients(book_id,participant_id),
 FOREIGN KEY(book_id,asset_id) REFERENCES public.stamp_book_styles(book_id,asset_id)
);
CREATE INDEX stamp_book_pending_reviews ON public.stamp_book_stamp_requests(book_id,status,created_at) WHERE status='pending';

CREATE TABLE public.stamp_book_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.stamp_book_stamp_requests(id),
 cycle_id uuid NOT NULL REFERENCES public.stamp_book_cycles(id),
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 space_id uuid NOT NULL,
 asset_id text NOT NULL REFERENCES public.stamp_book_artworks(asset_id),
 giver_user_id uuid NOT NULL REFERENCES auth.users(id),
 approved_by uuid REFERENCES auth.users(id),
 note text,
 stamped_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id),
 FOREIGN KEY(cycle_id,book_id) REFERENCES public.stamp_book_cycles(id,book_id)
);
CREATE INDEX stamp_book_marks_cycle ON public.stamp_book_marks(cycle_id,stamped_at);

CREATE TABLE public.stamp_book_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cycle_id uuid NOT NULL UNIQUE REFERENCES public.stamp_book_cycles(id),
 book_id uuid NOT NULL REFERENCES public.stamp_books(id),
 participant_id uuid NOT NULL REFERENCES public.participants(id),
 space_id uuid NOT NULL,
 reward_option_id uuid NOT NULL REFERENCES public.stamp_book_reward_options(id),
 reward_title_snapshot text NOT NULL,
 claimed_by uuid NOT NULL REFERENCES auth.users(id),
 idempotency_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','fulfilled','canceled')),
 fulfilled_by uuid REFERENCES auth.users(id),
 fulfilled_at timestamptz,
 canceled_by uuid REFERENCES auth.users(id),
 canceled_at timestamptz,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(book_id,claimed_by,idempotency_key),
 FOREIGN KEY(book_id,space_id) REFERENCES public.stamp_books(id,space_id),
 FOREIGN KEY(cycle_id,book_id) REFERENCES public.stamp_book_cycles(id,book_id),
 FOREIGN KEY(reward_option_id,book_id) REFERENCES public.stamp_book_reward_options(id,book_id)
);
CREATE INDEX stamp_book_claims_room_status ON public.stamp_book_claims(space_id,status,claimed_at DESC);

-- Read-only RLS. All mutations occur through narrowly authorized atomic RPCs.
DO $rls$
DECLARE v_table text;
BEGIN
 FOREACH v_table IN ARRAY ARRAY[
 'stamp_book_artworks','stamp_books','stamp_book_recipients','stamp_book_givers',
 'stamp_book_styles','stamp_book_reward_options','stamp_book_cycles',
 'stamp_book_stamp_requests','stamp_book_marks','stamp_book_claims'
 ] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
 EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_table);
 EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',v_table);
 END LOOP;
END $rls$;

CREATE POLICY stamp_book_artworks_read ON public.stamp_book_artworks FOR SELECT TO authenticated USING(true);
CREATE POLICY stamp_books_read ON public.stamp_books FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY stamp_book_recipients_read ON public.stamp_book_recipients FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id AND m.user_id=(SELECT auth.uid()))
 AND (EXISTS(SELECT 1 FROM public.participants p WHERE p.id=participant_id AND p.space_id=space_id
    AND (p.user_id=(SELECT auth.uid()) OR p.guardian_user_id=(SELECT auth.uid())))
 OR EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id
    AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin'))));
CREATE POLICY stamp_book_givers_read ON public.stamp_book_givers FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.stamp_books b JOIN public.space_members m
   ON m.space_id=b.space_id WHERE b.id=book_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY stamp_book_styles_read ON public.stamp_book_styles FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.stamp_books b JOIN public.space_members m
   ON m.space_id=b.space_id WHERE b.id=book_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY stamp_book_rewards_read ON public.stamp_book_reward_options FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY stamp_book_cycles_read ON public.stamp_book_cycles FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id
      AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin'))
   OR EXISTS(SELECT 1 FROM public.participants p WHERE p.id=participant_id
      AND p.space_id=space_id AND (p.user_id=(SELECT auth.uid()) OR p.guardian_user_id=(SELECT auth.uid()))));
CREATE POLICY stamp_book_requests_read ON public.stamp_book_stamp_requests FOR SELECT TO authenticated
 USING(giver_user_id=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id
     AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM public.participants p WHERE p.id=participant_id
     AND p.space_id=space_id AND (p.user_id=(SELECT auth.uid()) OR p.guardian_user_id=(SELECT auth.uid()))));
CREATE POLICY stamp_book_marks_read ON public.stamp_book_marks FOR SELECT TO authenticated
 USING(giver_user_id=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id
     AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM public.participants p WHERE p.id=participant_id
    AND p.space_id=space_id AND (p.user_id=(SELECT auth.uid()) OR p.guardian_user_id=(SELECT auth.uid()))));
CREATE POLICY stamp_book_claims_read ON public.stamp_book_claims FOR SELECT TO authenticated
 USING(claimed_by=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=space_id
     AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM public.participants p WHERE p.id=participant_id
    AND p.space_id=space_id AND (p.user_id=(SELECT auth.uid()) OR p.guardian_user_id=(SELECT auth.uid()))));

-- No direct write grants to authenticated/anon. SECURITY DEFINER *public RPCs*
-- explicitly require auth.uid() plus Room/child checks before any write.
CREATE OR REPLACE FUNCTION pointplus_private.book_is_manager(p_space uuid,p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.space_members m WHERE m.space_id=p_space
 AND m.user_id=p_user AND m.role IN ('owner','admin'));
$$;
REVOKE ALL ON FUNCTION pointplus_private.book_is_manager(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION pointplus_private.book_can_claim(p_space uuid,p_participant uuid,p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
 SELECT 1 FROM public.participants p JOIN public.space_members m
   ON m.space_id=p.space_id AND m.user_id=p_user
 WHERE p.id=p_participant AND p.space_id=p_space AND p.archived_at IS NULL
   AND (p.user_id=p_user OR (p.kind='child' AND p.guardian_user_id=p_user))
 );
$$;
REVOKE ALL ON FUNCTION pointplus_private.book_can_claim(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_create_stamp_book(
 p_space uuid, p_title text, p_description text, p_target integer,
 p_repeatable boolean, p_allow_self boolean, p_approval text,
 p_recipients uuid[], p_givers uuid[], p_styles text[], p_rewards text[]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_book uuid; v_person uuid; v_user uuid;
 v_style text; v_title text; v_count integer:=0; v_kind text;
BEGIN
 IF v_uid IS NULL OR NOT pointplus_private.book_is_manager(p_space,v_uid) THEN
  RAISE EXCEPTION 'Not authorized to create Stamp Books'; END IF;
 SELECT kind INTO v_kind FROM public.spaces WHERE id=p_space;
 IF v_kind IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160
 OR p_target NOT BETWEEN 1 AND 100 OR p_approval NOT IN('direct','approval_required')
 OR coalesce(length(p_description),0)>2000
 OR coalesce(cardinality(p_recipients),0) NOT BETWEEN 1 AND 30
 OR coalesce(cardinality(p_givers),0) NOT BETWEEN 1 AND 30
 OR coalesce(cardinality(p_styles),0) NOT BETWEEN 1 AND 18
 OR coalesce(cardinality(p_rewards),0) NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Invalid Stamp Book configuration'; END IF;
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
   p_target,p_repeatable,p_allow_self,p_approval,p_styles[1])
 RETURNING id INTO v_book;
 INSERT INTO public.stamp_book_recipients(book_id,participant_id,space_id)
 SELECT v_book, u.id, p_space FROM (SELECT DISTINCT unnest(p_recipients) AS id) u;
 INSERT INTO public.stamp_book_givers(book_id,user_id)
 SELECT v_book, u.id FROM (SELECT DISTINCT unnest(p_givers) AS id) u;
 INSERT INTO public.stamp_book_styles(book_id,asset_id)
 SELECT v_book, u.id FROM (SELECT DISTINCT unnest(p_styles) AS id) u;
 INSERT INTO public.stamp_book_reward_options(book_id,space_id,title)
 SELECT v_book,p_space,btrim(u.title) FROM unnest(p_rewards) AS u(title);
 INSERT INTO public.stamp_book_cycles(book_id,participant_id,space_id,cycle_no,target_snapshot)
 SELECT v_book, participant_id,p_space,1,p_target FROM public.stamp_book_recipients WHERE book_id=v_book;
 RETURN v_book;
END $$;
REVOKE ALL ON FUNCTION public.pointplus_create_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_create_stamp_book(uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[]) TO authenticated;

CREATE OR REPLACE FUNCTION pointplus_private.book_apply_stamp(p_request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION pointplus_private.book_apply_stamp(uuid) FROM PUBLIC,anon,authenticated;

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
 NOT EXISTS(SELECT 1 FROM public.stamp_book_givers g WHERE g.book_id=p_book AND g.user_id=v_uid) OR
 NOT EXISTS(SELECT 1 FROM public.stamp_book_recipients r WHERE r.book_id=p_book AND r.participant_id=p_recipient
  AND r.space_id=b.space_id) OR
 NOT EXISTS(SELECT 1 FROM public.stamp_book_styles s WHERE s.book_id=p_book AND s.asset_id=p_art)
 THEN RAISE EXCEPTION 'Not authorized to give this stamp'; END IF;
 SELECT kind INTO v_kind FROM public.spaces WHERE id=b.space_id;
 IF EXISTS(SELECT 1 FROM public.participants p WHERE p.id=p_recipient AND p.space_id=b.space_id
   AND p.user_id=v_uid) AND (v_kind<>'personal' OR NOT b.allow_self_stamp) THEN
   RAISE EXCEPTION 'Self-stamping is not permitted'; END IF;
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
REVOKE ALL ON FUNCTION public.pointplus_give_stamp(uuid,uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_give_stamp(uuid,uuid,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_review_stamp_request(p_request uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); req public.stamp_book_stamp_requests%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO req FROM public.stamp_book_stamp_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR req.status<>'pending' OR
 NOT pointplus_private.book_is_manager(req.space_id,v_uid) OR
 req.giver_user_id=v_uid THEN
   RAISE EXCEPTION 'Stamp review forbidden or already completed'; END IF;
 UPDATE public.stamp_book_stamp_requests SET
 status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 reviewed_by=v_uid, reviewed_at=now() WHERE id=p_request;
 IF p_approve THEN PERFORM pointplus_private.book_apply_stamp(p_request); END IF;
END $$;
REVOKE ALL ON FUNCTION public.pointplus_review_stamp_request(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_review_stamp_request(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_claim_stamp_book_reward(
 p_cycle uuid,p_reward uuid,p_key uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.pointplus_claim_stamp_book_reward(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_claim_stamp_book_reward(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_process_stamp_book_claim(p_claim uuid,p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); cl public.stamp_book_claims%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO cl FROM public.stamp_book_claims WHERE id=p_claim FOR UPDATE;
 IF NOT FOUND OR cl.status<>'requested' OR p_decision NOT IN ('fulfilled','canceled')
 OR NOT pointplus_private.book_is_manager(cl.space_id,v_uid) THEN
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
REVOKE ALL ON FUNCTION public.pointplus_process_stamp_book_claim(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_process_stamp_book_claim(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_update_stamp_book(
 p_book uuid,p_title text,p_description text,p_status text,p_target integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); b public.stamp_books%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO b FROM public.stamp_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR NOT pointplus_private.book_is_manager(b.space_id,v_uid)
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
REVOKE ALL ON FUNCTION public.pointplus_update_stamp_book(uuid,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_update_stamp_book(uuid,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.pointplus_add_stamp_book_reward(
 p_book uuid,p_title text,p_description text,p_stock integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); b public.stamp_books%ROWTYPE; v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO b FROM public.stamp_books WHERE id=p_book;
 IF NOT FOUND OR NOT pointplus_private.book_is_manager(b.space_id,v_uid) OR b.status='archived'
 OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160 OR
 coalesce(length(p_description),0)>2000 OR (p_stock IS NOT NULL AND p_stock<0)
 THEN RAISE EXCEPTION 'Invalid reward option'; END IF;
 INSERT INTO public.stamp_book_reward_options(book_id,space_id,title,description,stock_remaining)
 VALUES(p_book,b.space_id,btrim(p_title),nullif(btrim(p_description),''),p_stock)
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.pointplus_add_stamp_book_reward(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pointplus_add_stamp_book_reward(uuid,text,text,integer) TO authenticated;

-- Newly created data is isolated; no UPDATE/DELETE on legacy wallets,
-- badges, stamp cycles, mission submissions, or redemptions.
COMMIT;
