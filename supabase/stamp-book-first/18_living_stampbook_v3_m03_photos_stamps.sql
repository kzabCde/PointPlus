-- PointPlus Living Stampbook V3 — M03 Image & Stamp Interaction.
-- Additive; apply AFTER 16 (M01) and 17 (M02). DO NOT apply to Production
-- until M01–M05 release authorization. No legacy stamp/card tables are changed.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='120s';
DO $preflight$
BEGIN
 IF to_regclass('public.living_book_elements') IS NULL
   OR to_regclass('public.living_books') IS NULL
   OR to_regclass('storage.objects') IS NULL
   OR to_regclass('storage.buckets') IS NULL
 THEN RAISE EXCEPTION 'M01/M02 and Supabase Storage must exist first'; END IF;
 IF to_regclass('public.living_stamp_marks') IS NOT NULL
 THEN RAISE EXCEPTION 'M03 already installed; do not replay'; END IF;
END $preflight$;

-- Private storage. App writes unique file names, never upserts.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('pointplus-living-photos','pointplus-living-photos',false,6291456,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
DO $bucket$
BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets
  WHERE id='pointplus-living-photos' AND (public OR file_size_limit>6291456))
 THEN RAISE EXCEPTION 'Private photo bucket safety settings are incompatible'; END IF;
END $bucket$;

CREATE POLICY "living_photos_room_read_m03" ON storage.objects
FOR SELECT TO authenticated USING (
 bucket_id='pointplus-living-photos' AND EXISTS(
   SELECT 1 FROM public.living_book_pages p
   JOIN public.living_books b ON b.id=p.book_id
   JOIN public.space_members m ON m.space_id=b.space_id
   WHERE m.user_id=(SELECT auth.uid())
     AND b.space_id::text=split_part(name,'/',1)
     AND b.id::text=split_part(name,'/',2)
     AND p.id::text=split_part(name,'/',3)
     AND p.book_id=b.id
 ));
CREATE POLICY "living_photos_owner_insert_m03" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
 bucket_id='pointplus-living-photos'
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 AND EXISTS(
   SELECT 1 FROM public.living_book_pages p
   JOIN public.living_books b ON b.id=p.book_id
   JOIN public.space_members m ON m.space_id=b.space_id
   WHERE m.user_id=(SELECT auth.uid()) AND b.owner_user_id=(SELECT auth.uid())
     AND b.status='active'
     AND b.space_id::text=split_part(name,'/',1)
     AND b.id::text=split_part(name,'/',2)
     AND p.id::text=split_part(name,'/',3)
 ));
CREATE POLICY "living_photos_owner_delete_m03" ON storage.objects
FOR DELETE TO authenticated USING (
 bucket_id='pointplus-living-photos' AND EXISTS(
   SELECT 1 FROM public.living_book_pages p
   JOIN public.living_books b ON b.id=p.book_id
   JOIN public.space_members m ON m.space_id=b.space_id
   WHERE m.user_id=(SELECT auth.uid()) AND b.owner_user_id=(SELECT auth.uid())
     AND b.space_id::text=split_part(name,'/',1)
     AND b.id::text=split_part(name,'/',2)
     AND p.id::text=split_part(name,'/',3)
 ));

-- Photo metadata is a decorative editor object; it never affects stamp balance.
CREATE FUNCTION pointplus_private.living_image_payload_valid(p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $body$
DECLARE c jsonb; k text;
BEGIN
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
    OR length(p_payload::text)>2048
    OR jsonb_typeof(p_payload->'storagePath')<>'string'
    OR (p_payload->>'storagePath') !~
      '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
    OR (p_payload->>'mime') NOT IN ('image/png','image/jpeg','image/webp')
    OR jsonb_typeof(p_payload->'pixelWidth')<>'number'
    OR jsonb_typeof(p_payload->'pixelHeight')<>'number'
    OR (p_payload->>'pixelWidth')::numeric NOT BETWEEN 1 AND 8192
    OR (p_payload->>'pixelHeight')::numeric NOT BETWEEN 1 AND 8192
 THEN RETURN false; END IF;
 c:=p_payload->'crop';
 IF jsonb_typeof(c)<>'object' THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['x','y','width','height'] LOOP
   IF jsonb_typeof(c->k)<>'number' OR (c->>k)::numeric NOT BETWEEN 0 AND 1
   THEN RETURN false; END IF;
 END LOOP;
 RETURN (c->>'width')::numeric>0 AND (c->>'height')::numeric>0
   AND (c->>'x')::numeric+(c->>'width')::numeric<=1
   AND (c->>'y')::numeric+(c->>'height')::numeric<=1;
EXCEPTION WHEN others THEN RETURN false;
END $body$;
REVOKE ALL ON FUNCTION pointplus_private.living_image_payload_valid(jsonb)
FROM PUBLIC,anon,authenticated;

ALTER TABLE public.living_book_elements
  DROP CONSTRAINT living_book_elements_element_type_check;
ALTER TABLE public.living_book_elements
  ADD CONSTRAINT living_book_elements_element_type_check
  CHECK (element_type IN ('text','drawing','image'));
ALTER TABLE public.living_book_elements
  DROP CONSTRAINT living_book_elements_payload_check;
ALTER TABLE public.living_book_elements
  ADD CONSTRAINT living_book_elements_payload_check
  CHECK (CASE WHEN element_type='image'
    THEN pointplus_private.living_image_payload_valid(payload)
    ELSE pointplus_private.living_editor_payload_valid(element_type,payload) END);
CREATE UNIQUE INDEX living_images_unique_storage_path
  ON public.living_book_elements((payload->>'storagePath'))
  WHERE element_type='image';

CREATE FUNCTION public.pointplus_create_living_book_image(
  p_book uuid,p_page uuid,p_element uuid,p_path text,p_mime text,
  p_pixel_width integer,p_pixel_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid(); v_book public.living_books%ROWTYPE;
  v_existing public.living_book_elements%ROWTYPE; v_payload jsonb;
  v_extension text; v_size numeric;
BEGIN
 IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_element IS NULL
   OR p_path IS NULL OR p_mime NOT IN('image/png','image/jpeg','image/webp')
   OR p_pixel_width NOT BETWEEN 1 AND 8192 OR p_pixel_height NOT BETWEEN 1 AND 8192
 THEN RAISE EXCEPTION 'Invalid photo input' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
   OR NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.living_book_pages WHERE book_id=p_book AND id=p_page)
 THEN RAISE EXCEPTION 'Page not in Living Book' USING ERRCODE='22023'; END IF;
 v_extension:=CASE p_mime WHEN 'image/png' THEN 'png'
   WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
 IF p_path <> v_book.space_id::text||'/'||p_book::text||'/'||p_page::text||'/'||
   p_element::text||'.'||v_extension
   OR NOT EXISTS(SELECT 1 FROM storage.objects
     WHERE bucket_id='pointplus-living-photos' AND name=p_path)
 THEN RAISE EXCEPTION 'Invalid or missing private photo object' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('storagePath',p_path,'mime',p_mime,
   'pixelWidth',p_pixel_width,'pixelHeight',p_pixel_height,
   'crop',jsonb_build_object('x',0,'y',0,'width',1,'height',1));
 SELECT * INTO v_existing FROM public.living_book_elements WHERE id=p_element FOR UPDATE;
 IF FOUND THEN
   IF v_existing.book_id<>p_book OR v_existing.page_id<>p_page
     OR v_existing.element_type<>'image' OR v_existing.payload<>v_payload
     OR v_existing.deleted_at IS NOT NULL
   THEN RAISE EXCEPTION 'Conflicting photo idempotency key' USING ERRCODE='40001'; END IF;
   RETURN jsonb_build_object('id',v_existing.id,'version',v_existing.version);
 END IF;
 v_size:=least(0.60, greatest(0.15, 0.45*p_pixel_height::numeric/p_pixel_width));
 INSERT INTO public.living_book_elements(id,book_id,page_id,element_type,payload,
   position_x,position_y,width,height,rotation_deg,opacity,z_index,created_by)
 VALUES(p_element,p_book,p_page,'image',v_payload,0.25,0.25,0.45,v_size,0,1,100,v_uid);
 RETURN jsonb_build_object('id',p_element,'version',1);
END $fn$;

CREATE FUNCTION public.pointplus_transform_living_book_image(
  p_book uuid,p_page uuid,p_element uuid,p_x numeric,p_y numeric,
  p_w numeric,p_h numeric,p_rotation numeric,p_opacity numeric,p_z integer,
  p_crop jsonb,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_book public.living_books%ROWTYPE;
  v_image public.living_book_elements%ROWTYPE; v_payload jsonb;
BEGIN
 IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_element IS NULL
   OR p_expected_version IS NULL OR p_expected_version<1
   OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1 OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
   OR p_w IS NULL OR p_w NOT BETWEEN 0.005 AND 1
   OR p_h IS NULL OR p_h NOT BETWEEN 0.005 AND 1
   OR p_rotation IS NULL OR p_rotation NOT BETWEEN -180 AND 180
   OR p_opacity IS NULL OR p_opacity NOT BETWEEN 0.05 AND 1
   OR p_z IS NULL OR p_z NOT BETWEEN -1000000 AND 1000000
 THEN RAISE EXCEPTION 'Invalid photo transform' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
   OR NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_image FROM public.living_book_elements
 WHERE id=p_element AND book_id=p_book AND page_id=p_page AND element_type='image'
   AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Photo not on this page' USING ERRCODE='22023'; END IF;
 IF v_image.version<>p_expected_version
 THEN RAISE EXCEPTION 'Photo changed elsewhere' USING ERRCODE='40001'; END IF;
 v_payload:=jsonb_set(v_image.payload,'{crop}',p_crop,true);
 IF NOT pointplus_private.living_image_payload_valid(v_payload)
 THEN RAISE EXCEPTION 'Invalid crop' USING ERRCODE='22023'; END IF;
 UPDATE public.living_book_elements
 SET payload=v_payload,position_x=p_x,position_y=p_y,width=p_w,height=p_h,
   rotation_deg=p_rotation,opacity=p_opacity,z_index=p_z,
   version=version+1,updated_at=now()
 WHERE id=p_element RETURNING * INTO v_image;
 RETURN jsonb_build_object('id',v_image.id,'version',v_image.version);
END $fn$;

-- A real stamp is NOT an editor element. Its unique mark id is spendable only
-- while state='available'; peeling leaves an immutable receipt for M04.
CREATE TABLE public.living_stamp_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL,space_id uuid NOT NULL,page_id uuid NOT NULL,
 recipient_participant_id uuid NOT NULL,giver_user_id uuid NOT NULL,
 asset_id text NOT NULL REFERENCES public.stamp_book_artworks(asset_id),
 note text CHECK(note IS NULL OR length(note)<=1000),
 position_x numeric NOT NULL CHECK(position_x BETWEEN 0 AND 1),
 position_y numeric NOT NULL CHECK(position_y BETWEEN 0 AND 1),
 rotation_deg numeric NOT NULL CHECK(rotation_deg BETWEEN -180 AND 180),
 scale_factor numeric NOT NULL CHECK(scale_factor BETWEEN 0.3 AND 3),
 status text NOT NULL CHECK(status IN('pending','approved','rejected','canceled')),
 idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,reviewed_by uuid REFERENCES auth.users(id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(book_id,page_id) REFERENCES public.living_book_pages(book_id,id),
 FOREIGN KEY(book_id,recipient_participant_id) REFERENCES public.living_books(id,recipient_participant_id),
 FOREIGN KEY(book_id,giver_user_id) REFERENCES public.living_book_givers(book_id,user_id),
 UNIQUE(book_id,giver_user_id,idempotency_key),
 UNIQUE(id,book_id)
);
CREATE INDEX living_stamp_requests_page_idx ON public.living_stamp_requests(page_id,created_at DESC);
CREATE INDEX living_stamp_requests_pending_idx ON public.living_stamp_requests(book_id,created_at)
 WHERE status='pending';

CREATE TABLE public.living_stamp_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,book_id uuid NOT NULL,space_id uuid NOT NULL,
 page_id uuid NOT NULL,recipient_participant_id uuid NOT NULL,giver_user_id uuid NOT NULL,
 asset_id text NOT NULL REFERENCES public.stamp_book_artworks(asset_id),
 note text CHECK(note IS NULL OR length(note)<=1000),
 position_x numeric NOT NULL CHECK(position_x BETWEEN 0 AND 1),
 position_y numeric NOT NULL CHECK(position_y BETWEEN 0 AND 1),
 rotation_deg numeric NOT NULL CHECK(rotation_deg BETWEEN -180 AND 180),
 scale_factor numeric NOT NULL CHECK(scale_factor BETWEEN 0.3 AND 3),
 state text NOT NULL DEFAULT 'available' CHECK(state IN('available','peeled')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1),
 granted_at timestamptz NOT NULL DEFAULT now(),
 peeled_at timestamptz,peeled_by uuid REFERENCES auth.users(id),
 FOREIGN KEY(request_id,book_id) REFERENCES public.living_stamp_requests(id,book_id),
 FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(book_id,page_id) REFERENCES public.living_book_pages(book_id,id),
 FOREIGN KEY(book_id,recipient_participant_id) REFERENCES public.living_books(id,recipient_participant_id),
 CHECK ((state='peeled' AND peeled_at IS NOT NULL AND peeled_by IS NOT NULL)
    OR (state='available' AND peeled_at IS NULL AND peeled_by IS NULL))
);
CREATE INDEX living_stamp_marks_page_idx ON public.living_stamp_marks(page_id,granted_at,id);
CREATE INDEX living_stamp_marks_available_idx ON public.living_stamp_marks(book_id,granted_at,id)
 WHERE state='available';

CREATE TABLE public.living_stamp_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 book_id uuid NOT NULL,mark_id uuid NOT NULL REFERENCES public.living_stamp_marks(id),
 event_type text NOT NULL CHECK(event_type IN('granted','transformed','peeled')),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'
   AND length(details::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(book_id) REFERENCES public.living_books(id) ON DELETE CASCADE
);
CREATE INDEX living_stamp_events_mark_idx ON public.living_stamp_events(mark_id,created_at);

ALTER TABLE public.living_stamp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_stamp_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_stamp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.living_stamp_requests,public.living_stamp_marks,
  public.living_stamp_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.living_stamp_requests,public.living_stamp_marks,
  public.living_stamp_events TO authenticated;
CREATE POLICY living_stamp_requests_members_read ON public.living_stamp_requests
 FOR SELECT TO authenticated USING (EXISTS(
 SELECT 1 FROM public.space_members m WHERE m.space_id=living_stamp_requests.space_id
 AND m.user_id=(SELECT auth.uid())));
CREATE POLICY living_stamp_marks_members_read ON public.living_stamp_marks
 FOR SELECT TO authenticated USING (EXISTS(
 SELECT 1 FROM public.space_members m WHERE m.space_id=living_stamp_marks.space_id
 AND m.user_id=(SELECT auth.uid())));
CREATE POLICY living_stamp_events_members_read ON public.living_stamp_events
 FOR SELECT TO authenticated USING (EXISTS(
 SELECT 1 FROM public.living_books b JOIN public.space_members m
   ON m.space_id=b.space_id
 WHERE b.id=living_stamp_events.book_id AND m.user_id=(SELECT auth.uid())));

CREATE FUNCTION public.pointplus_give_living_stamp(
 p_book uuid,p_page uuid,p_asset text,p_note text,p_key uuid,
 p_x numeric,p_y numeric,p_rotation numeric,p_scale numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_book public.living_books%ROWTYPE;
 v_request public.living_stamp_requests%ROWTYPE;v_mark uuid;
 v_status text;
BEGIN
 IF v_uid IS NULL OR p_key IS NULL OR p_book IS NULL OR p_page IS NULL
   OR p_asset IS NULL OR p_note IS NULL OR length(p_note)>1000
   OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1
   OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
   OR p_rotation IS NULL OR p_rotation NOT BETWEEN -180 AND 180
   OR p_scale IS NULL OR p_scale NOT BETWEEN 0.3 AND 3
 THEN RAISE EXCEPTION 'Invalid stamp request' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
 IF NOT FOUND OR v_book.status<>'active' OR
   NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
   OR NOT EXISTS(SELECT 1 FROM public.living_book_givers g
     WHERE g.book_id=p_book AND g.user_id=v_uid)
 THEN RAISE EXCEPTION 'Not authorized to give a stamp' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.living_book_pages p WHERE p.id=p_page AND p.book_id=p_book)
   OR NOT EXISTS(SELECT 1 FROM public.stamp_book_artworks a WHERE a.asset_id=p_asset)
 THEN RAISE EXCEPTION 'Invalid Living Book page or artwork' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_requests r
 WHERE r.book_id=p_book AND r.giver_user_id=v_uid AND r.idempotency_key=p_key;
 IF FOUND THEN
   IF v_request.page_id<>p_page OR v_request.asset_id<>p_asset
    OR coalesce(v_request.note,'')<>p_note OR v_request.position_x<>p_x
    OR v_request.position_y<>p_y OR v_request.rotation_deg<>p_rotation
    OR v_request.scale_factor<>p_scale
   THEN RAISE EXCEPTION 'Idempotency key used with different stamp input' USING ERRCODE='22023'; END IF;
   SELECT id INTO v_mark FROM public.living_stamp_marks WHERE request_id=v_request.id;
   RETURN jsonb_build_object('request_id',v_request.id,'mark_id',v_mark,'status',v_request.status);
 END IF;
 v_status:=CASE WHEN v_book.approval_policy='approval_required' THEN 'pending' ELSE 'approved' END;
 IF v_status='pending' AND NOT EXISTS(
   SELECT 1 FROM public.participants p LEFT JOIN public.space_members m
     ON m.space_id=v_book.space_id
   WHERE p.id=v_book.recipient_participant_id AND p.space_id=v_book.space_id
     AND ((p.user_id IS NOT NULL AND p.user_id=m.user_id)
       OR (p.user_id IS NULL AND m.role IN('owner','admin')))
     AND m.user_id<>v_uid
 ) THEN RAISE EXCEPTION 'Approval requires a distinct authorized reviewer' USING ERRCODE='42501'; END IF;
 INSERT INTO public.living_stamp_requests(book_id,space_id,page_id,
   recipient_participant_id,giver_user_id,asset_id,note,
   position_x,position_y,rotation_deg,scale_factor,status,idempotency_key)
 VALUES(p_book,v_book.space_id,p_page,v_book.recipient_participant_id,
   v_uid,p_asset,nullif(p_note,''),p_x,p_y,p_rotation,p_scale,v_status,p_key)
 RETURNING * INTO v_request;
 IF v_status='approved' THEN
   INSERT INTO public.living_stamp_marks(request_id,book_id,space_id,page_id,
     recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,
     rotation_deg,scale_factor)
   VALUES(v_request.id,p_book,v_book.space_id,p_page,v_book.recipient_participant_id,
     v_uid,p_asset,nullif(p_note,''),p_x,p_y,p_rotation,p_scale)
   RETURNING id INTO v_mark;
   INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id)
     VALUES(p_book,v_mark,'granted',v_uid);
 END IF;
 RETURN jsonb_build_object('request_id',v_request.id,'mark_id',v_mark,'status',v_status);
END $fn$;

CREATE FUNCTION public.pointplus_review_living_stamp(
 p_request uuid,p_approve boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_request public.living_stamp_requests%ROWTYPE;
 v_book public.living_books%ROWTYPE;v_recipient public.participants%ROWTYPE;
 v_mark uuid;
BEGIN
 IF v_uid IS NULL OR p_request IS NULL OR p_approve IS NULL
 THEN RAISE EXCEPTION 'Invalid review input' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_requests WHERE id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stamp request not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_request.book_id FOR UPDATE;
 SELECT * INTO v_request FROM public.living_stamp_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR v_request.status<>'pending' OR v_book.status<>'active'
 THEN RAISE EXCEPTION 'Stamp request is not pending on active book' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_recipient FROM public.participants
 WHERE id=v_book.recipient_participant_id AND space_id=v_book.space_id;
 IF v_uid=v_request.giver_user_id OR NOT EXISTS(
   SELECT 1 FROM public.space_members m
   WHERE m.space_id=v_book.space_id AND m.user_id=v_uid
     AND ((v_recipient.user_id IS NOT NULL AND v_recipient.user_id=v_uid)
       OR (v_recipient.user_id IS NULL AND m.role IN('owner','admin')))
 ) THEN RAISE EXCEPTION 'Only the independent recipient/reviewer can approve' USING ERRCODE='42501'; END IF;
 UPDATE public.living_stamp_requests SET
  status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=v_uid,reviewed_at=now()
 WHERE id=p_request RETURNING * INTO v_request;
 IF p_approve THEN
   INSERT INTO public.living_stamp_marks(request_id,book_id,space_id,page_id,
     recipient_participant_id,giver_user_id,asset_id,note,position_x,position_y,
     rotation_deg,scale_factor)
   VALUES(v_request.id,v_book.id,v_book.space_id,v_request.page_id,
     v_book.recipient_participant_id,v_request.giver_user_id,v_request.asset_id,
     v_request.note,v_request.position_x,v_request.position_y,
     v_request.rotation_deg,v_request.scale_factor)
   RETURNING id INTO v_mark;
   INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id)
   VALUES(v_book.id,v_mark,'granted',v_uid);
 END IF;
 RETURN jsonb_build_object('request_id',p_request,'status',v_request.status,'mark_id',v_mark);
END $fn$;

CREATE FUNCTION public.pointplus_cancel_living_stamp_request(p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_request public.living_stamp_requests%ROWTYPE;
 v_book public.living_books%ROWTYPE;
BEGIN
 IF v_uid IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'Invalid cancel input' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_request FROM public.living_stamp_requests WHERE id=p_request;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stamp request not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_request.book_id FOR UPDATE;
 SELECT * INTO v_request FROM public.living_stamp_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR v_request.status<>'pending' OR v_book.status<>'active'
   OR (v_uid<>v_request.giver_user_id AND v_uid<>v_book.owner_user_id)
   OR NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Cannot cancel this pending stamp' USING ERRCODE='42501'; END IF;
 UPDATE public.living_stamp_requests SET status='canceled',
 reviewed_by=v_uid,reviewed_at=now() WHERE id=p_request;
 RETURN jsonb_build_object('request_id',p_request,'status','canceled');
END $fn$;

CREATE FUNCTION public.pointplus_transform_living_stamp(
 p_mark uuid,p_page uuid,p_x numeric,p_y numeric,p_rotation numeric,
 p_scale numeric,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_stamp public.living_stamp_marks%ROWTYPE;
 v_book public.living_books%ROWTYPE;v_old jsonb;
BEGIN
 IF v_uid IS NULL OR p_mark IS NULL OR p_page IS NULL
   OR p_expected_version IS NULL OR p_expected_version<1
   OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1
   OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
   OR p_rotation IS NULL OR p_rotation NOT BETWEEN -180 AND 180
   OR p_scale IS NULL OR p_scale NOT BETWEEN 0.3 AND 3
 THEN RAISE EXCEPTION 'Invalid stamp transform' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_stamp FROM public.living_stamp_marks WHERE id=p_mark;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stamp not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_stamp.book_id FOR UPDATE;
 IF NOT FOUND OR v_book.status<>'active' OR v_book.owner_user_id<>v_uid
  OR NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Only active book owner can transform stamps' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_stamp FROM public.living_stamp_marks WHERE id=p_mark FOR UPDATE;
 IF v_stamp.state<>'available' THEN
   RAISE EXCEPTION 'Used or peeled stamp cannot be moved' USING ERRCODE='22023'; END IF;
 IF v_stamp.version<>p_expected_version
 THEN RAISE EXCEPTION 'Stamp was modified elsewhere' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.living_book_pages WHERE id=p_page AND book_id=v_book.id)
 THEN RAISE EXCEPTION 'Target page does not belong to stamp book' USING ERRCODE='22023'; END IF;
 v_old:=jsonb_build_object('page_id',v_stamp.page_id,'x',v_stamp.position_x,
   'y',v_stamp.position_y,'rotation',v_stamp.rotation_deg,'scale',v_stamp.scale_factor);
 UPDATE public.living_stamp_marks SET page_id=p_page,
  position_x=p_x,position_y=p_y,rotation_deg=p_rotation,scale_factor=p_scale,
  version=version+1 WHERE id=p_mark RETURNING * INTO v_stamp;
 INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id,details)
 VALUES(v_book.id,v_stamp.id,'transformed',v_uid,
   jsonb_build_object('previous',v_old,'new',jsonb_build_object(
    'page_id',p_page,'x',p_x,'y',p_y,'rotation',p_rotation,'scale',p_scale)));
 RETURN jsonb_build_object('id',v_stamp.id,'version',v_stamp.version,'state',v_stamp.state);
END $fn$;

CREATE FUNCTION public.pointplus_peel_living_stamp(p_mark uuid,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();v_stamp public.living_stamp_marks%ROWTYPE;
 v_book public.living_books%ROWTYPE;
BEGIN
 IF v_uid IS NULL OR p_mark IS NULL OR p_expected_version IS NULL OR p_expected_version<1
 THEN RAISE EXCEPTION 'Invalid peel request' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_stamp FROM public.living_stamp_marks WHERE id=p_mark;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stamp not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_book FROM public.living_books WHERE id=v_stamp.book_id FOR UPDATE;
 IF NOT FOUND OR v_book.status<>'active' OR v_book.owner_user_id<>v_uid
  OR NOT EXISTS(SELECT 1 FROM public.space_members m
     WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
 THEN RAISE EXCEPTION 'Only active book owner may peel stamps' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_stamp FROM public.living_stamp_marks WHERE id=p_mark FOR UPDATE;
 IF v_stamp.state<>'available' OR v_stamp.version<>p_expected_version
 THEN RAISE EXCEPTION 'Stamp cannot be peeled or was changed elsewhere' USING ERRCODE='40001'; END IF;
 UPDATE public.living_stamp_marks
 SET state='peeled',peeled_at=now(),peeled_by=v_uid,version=version+1
 WHERE id=p_mark RETURNING * INTO v_stamp;
 INSERT INTO public.living_stamp_events(book_id,mark_id,event_type,actor_user_id)
 VALUES(v_book.id,v_stamp.id,'peeled',v_uid);
 RETURN jsonb_build_object('id',v_stamp.id,'version',v_stamp.version,'state',v_stamp.state);
END $fn$;

REVOKE ALL ON FUNCTION public.pointplus_create_living_book_image(
 uuid,uuid,uuid,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_transform_living_book_image(
 uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,integer,jsonb,bigint)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_give_living_stamp(
 uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_review_living_stamp(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_cancel_living_stamp_request(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_transform_living_stamp(
 uuid,uuid,numeric,numeric,numeric,numeric,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_peel_living_stamp(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_create_living_book_image(
 uuid,uuid,uuid,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_transform_living_book_image(
 uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,integer,jsonb,bigint)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_give_living_stamp(
 uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_review_living_stamp(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_cancel_living_stamp_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_transform_living_stamp(
 uuid,uuid,numeric,numeric,numeric,numeric,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_peel_living_stamp(uuid,bigint) TO authenticated;
COMMIT;
