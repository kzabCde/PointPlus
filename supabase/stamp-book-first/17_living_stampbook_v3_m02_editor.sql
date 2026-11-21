-- PointPlus Living Stampbook V3 — M02 Page Manager & Paper Editor.
-- ADDITIVE; apply 16_living_stampbook_v3_m01.sql first in isolated DB.
-- DO NOT apply to Production before M01–M05 release gates.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.living_books') IS NULL
     OR to_regclass('public.living_book_pages') IS NULL
     OR to_regprocedure('public.pointplus_add_living_book_page(uuid,uuid,text,text)') IS NULL
  THEN RAISE EXCEPTION 'Living Stampbook M01 must be installed first'; END IF;
  IF to_regclass('public.living_book_elements') IS NOT NULL
  THEN RAISE EXCEPTION 'Living Stampbook M02 is already installed; do not replay'; END IF;
END $preflight$;

-- The editor persists vector drawing and text only. Photos are introduced in M03.
-- One drawing path per element; path size is bounded to avoid abusive payloads,
-- while lifetime page, object and stamp totals have NO hard cap.
CREATE FUNCTION pointplus_private.living_editor_payload_valid(p_type text,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
DECLARE
  v_point jsonb;
  v_n numeric;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
     OR length(p_payload::text)>65536 THEN RETURN false; END IF;
  IF p_type='text' THEN
    IF jsonb_typeof(p_payload->'text')<>'string'
       OR length(p_payload->>'text')>5000
       OR coalesce(p_payload->>'fontFamily','') NOT IN ('sans','serif','mono')
       OR coalesce(p_payload->>'align','') NOT IN ('left','center','right')
       OR jsonb_typeof(p_payload->'fontSize')<>'number'
       OR coalesce(p_payload->>'color','') !~ '^#[0-9a-fA-F]{6}$'
       OR jsonb_typeof(p_payload->'bold')<>'boolean'
       OR jsonb_typeof(p_payload->'italic')<>'boolean'
    THEN RETURN false; END IF;
    v_n := (p_payload->>'fontSize')::numeric;
    RETURN v_n BETWEEN 12 AND 120;
  ELSIF p_type='drawing' THEN
    IF jsonb_typeof(p_payload->'points')<>'array'
       OR jsonb_typeof(p_payload->'strokeWidth')<>'number'
       OR coalesce(p_payload->>'color','') !~ '^#[0-9a-fA-F]{6}$'
    THEN RETURN false; END IF;
    v_n := (p_payload->>'strokeWidth')::numeric;
    IF v_n NOT BETWEEN 1 AND 30
       OR jsonb_array_length(p_payload->'points') NOT BETWEEN 2 AND 1200
    THEN RETURN false; END IF;
    FOR v_point IN SELECT value FROM jsonb_array_elements(p_payload->'points')
    LOOP
      IF jsonb_typeof(v_point)<>'object'
         OR jsonb_typeof(v_point->'x')<>'number'
         OR jsonb_typeof(v_point->'y')<>'number'
      THEN RETURN false; END IF;
      IF (v_point->>'x')::numeric NOT BETWEEN 0 AND 1
         OR (v_point->>'y')::numeric NOT BETWEEN 0 AND 1
      THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;
  RETURN false;
EXCEPTION WHEN others THEN RETURN false;
END $fn$;

REVOKE ALL ON FUNCTION pointplus_private.living_editor_payload_valid(text,jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.living_book_elements (
  id uuid PRIMARY KEY,
  book_id uuid NOT NULL,
  page_id uuid NOT NULL,
  element_type text NOT NULL CHECK (element_type IN ('text','drawing')),
  payload jsonb NOT NULL,
  position_x numeric NOT NULL CHECK (position_x BETWEEN 0 AND 1),
  position_y numeric NOT NULL CHECK (position_y BETWEEN 0 AND 1),
  width numeric NOT NULL CHECK (width BETWEEN 0.005 AND 1),
  height numeric NOT NULL CHECK (height BETWEEN 0.005 AND 1),
  rotation_deg numeric NOT NULL DEFAULT 0 CHECK (rotation_deg BETWEEN -180 AND 180),
  opacity numeric NOT NULL DEFAULT 1 CHECK (opacity BETWEEN 0.05 AND 1),
  z_index integer NOT NULL DEFAULT 0 CHECK (z_index BETWEEN -1000000 AND 1000000),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  FOREIGN KEY (book_id,page_id)
    REFERENCES public.living_book_pages(book_id,id) ON DELETE CASCADE,
  CONSTRAINT living_book_elements_payload_check
    CHECK (pointplus_private.living_editor_payload_valid(element_type,payload))
);
CREATE INDEX living_book_elements_page_z_idx
  ON public.living_book_elements(page_id,z_index,id)
  WHERE deleted_at IS NULL;
CREATE INDEX living_book_elements_book_page_idx
  ON public.living_book_elements(book_id,page_id);

ALTER TABLE public.living_book_elements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.living_book_elements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.living_book_elements TO authenticated;
CREATE POLICY living_elements_room_member_read
  ON public.living_book_elements FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.living_books b
      JOIN public.space_members m ON m.space_id=b.space_id
      WHERE b.id=living_book_elements.book_id
        AND m.user_id=(SELECT auth.uid())
    )
  );

-- Only the owner of an active book can rename or restyle a page.
-- Page versions provide optimistic conflict detection between tabs/devices.
CREATE FUNCTION public.pointplus_update_living_book_page(
  p_book uuid,p_page uuid,p_title text,p_background text,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();
DECLARE v_book public.living_books%ROWTYPE;
DECLARE v_page public.living_book_pages%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_expected_version IS NULL
     OR p_expected_version<1 OR length(coalesce(p_title,''))>160
     OR p_background IS NULL
     OR p_background NOT IN ('cream','white','lined','grid','kraft')
  THEN RAISE EXCEPTION 'Invalid page update' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
     OR NOT EXISTS (SELECT 1 FROM public.space_members m
       WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active Living Book owner can edit pages' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_page FROM public.living_book_pages
    WHERE book_id=p_book AND id=p_page FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Page does not belong to this book' USING ERRCODE='22023'; END IF;
  IF v_page.version<>p_expected_version
  THEN RAISE EXCEPTION 'Page was modified elsewhere; reload to resolve' USING ERRCODE='40001'; END IF;
  UPDATE public.living_book_pages
    SET title=nullif(btrim(p_title),''),background_style=p_background,
        version=version+1,updated_at=now()
    WHERE id=p_page
    RETURNING * INTO v_page;
  RETURN jsonb_build_object('id',v_page.id,'version',v_page.version,
    'title',v_page.title,'background_style',v_page.background_style);
END $fn$;

-- Atomic create/update of a single decorative object. Artwork is NOT a stamp.
-- p_expected_version=0 means create; version>=1 means edit existing object.
CREATE FUNCTION public.pointplus_save_living_book_element(
  p_book uuid,p_page uuid,p_element uuid,p_type text,p_payload jsonb,
  p_x numeric,p_y numeric,p_width numeric,p_height numeric,p_rotation numeric,
  p_opacity numeric,p_z integer,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();
DECLARE v_book public.living_books%ROWTYPE;
DECLARE v_element public.living_book_elements%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_element IS NULL
     OR p_expected_version IS NULL OR p_expected_version<0
     OR p_type IS NULL OR p_type NOT IN ('text','drawing')
     OR NOT pointplus_private.living_editor_payload_valid(p_type,p_payload)
     OR p_x IS NULL OR p_x NOT BETWEEN 0 AND 1
     OR p_y IS NULL OR p_y NOT BETWEEN 0 AND 1
     OR p_width IS NULL OR p_width NOT BETWEEN 0.005 AND 1
     OR p_height IS NULL OR p_height NOT BETWEEN 0.005 AND 1
     OR p_rotation IS NULL OR p_rotation NOT BETWEEN -180 AND 180
     OR p_opacity IS NULL OR p_opacity NOT BETWEEN 0.05 AND 1
     OR p_z IS NULL OR p_z NOT BETWEEN -1000000 AND 1000000
  THEN RAISE EXCEPTION 'Invalid paper element' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
     OR NOT EXISTS (SELECT 1 FROM public.space_members m
       WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active Living Book owner can edit decorations' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.living_book_pages p
       WHERE p.book_id=p_book AND p.id=p_page)
  THEN RAISE EXCEPTION 'Page does not belong to this book' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_element FROM public.living_book_elements
    WHERE id=p_element FOR UPDATE;
  IF p_expected_version=0 THEN
    IF FOUND THEN RAISE EXCEPTION 'Decoration already exists' USING ERRCODE='40001'; END IF;
    INSERT INTO public.living_book_elements(
      id,book_id,page_id,element_type,payload,position_x,position_y,
      width,height,rotation_deg,opacity,z_index,created_by
    ) VALUES(
      p_element,p_book,p_page,p_type,p_payload,p_x,p_y,
      p_width,p_height,p_rotation,p_opacity,p_z,v_uid
    ) RETURNING * INTO v_element;
  ELSE
    IF NOT FOUND OR v_element.book_id<>p_book OR v_element.page_id<>p_page
       OR v_element.deleted_at IS NOT NULL OR v_element.element_type<>p_type
    THEN RAISE EXCEPTION 'Decoration no longer exists in this page' USING ERRCODE='22023'; END IF;
    IF v_element.version<>p_expected_version
    THEN RAISE EXCEPTION 'Decoration was modified elsewhere; reload to resolve' USING ERRCODE='40001'; END IF;
    UPDATE public.living_book_elements SET
      payload=p_payload,position_x=p_x,position_y=p_y,width=p_width,height=p_height,
      rotation_deg=p_rotation,opacity=p_opacity,z_index=p_z,
      version=version+1,updated_at=now()
    WHERE id=p_element RETURNING * INTO v_element;
  END IF;
  RETURN jsonb_build_object('id',v_element.id,'version',v_element.version,
    'updated_at',v_element.updated_at);
END $fn$;

CREATE FUNCTION public.pointplus_delete_living_book_element(
  p_book uuid,p_page uuid,p_element uuid,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid:=auth.uid();
DECLARE v_book public.living_books%ROWTYPE;
DECLARE v_element public.living_book_elements%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_element IS NULL
     OR p_expected_version IS NULL OR p_expected_version<1
  THEN RAISE EXCEPTION 'Invalid delete request' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
     OR NOT EXISTS (SELECT 1 FROM public.space_members m
       WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active Living Book owner can remove decorations' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_element FROM public.living_book_elements
    WHERE id=p_element AND book_id=p_book AND page_id=p_page FOR UPDATE;
  IF NOT FOUND OR v_element.deleted_at IS NOT NULL
  THEN RAISE EXCEPTION 'Decoration not found' USING ERRCODE='22023'; END IF;
  IF v_element.version<>p_expected_version
  THEN RAISE EXCEPTION 'Decoration was modified elsewhere; reload to resolve' USING ERRCODE='40001'; END IF;
  UPDATE public.living_book_elements
    SET deleted_at=now(),version=version+1,updated_at=now()
    WHERE id=p_element RETURNING * INTO v_element;
  RETURN jsonb_build_object('id',v_element.id,'version',v_element.version,'deleted',true);
END $fn$;

REVOKE ALL ON FUNCTION public.pointplus_update_living_book_page(uuid,uuid,text,text,bigint)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_save_living_book_element(
  uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,integer,bigint)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pointplus_delete_living_book_element(uuid,uuid,uuid,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_update_living_book_page(uuid,uuid,text,text,bigint)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_save_living_book_element(
  uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,integer,bigint)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_delete_living_book_element(uuid,uuid,uuid,bigint)
  TO authenticated;
COMMIT;
