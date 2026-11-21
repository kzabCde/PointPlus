-- POINT+ Living Stampbook V3 — M01 (additive, not applied to Production)
-- Requires Room-First and Stamp Book First migrations through v2.3.
-- The legacy finite-cycle Stamp Cards and all existing functions are unchanged.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $preflight$
BEGIN
  IF to_regclass('public.spaces') IS NULL
    OR to_regclass('public.space_members') IS NULL
    OR to_regclass('public.participants') IS NULL
    OR to_regclass('public.stamp_book_artworks') IS NULL
    OR to_regclass('public.stamp_books') IS NULL
  THEN RAISE EXCEPTION 'PointPlus baseline is missing; abort M01 migration'; END IF;
  IF to_regclass('public.living_books') IS NOT NULL
  THEN RAISE EXCEPTION 'Living Book schema already present; do not replay M01'; END IF;
END $preflight$;

CREATE TABLE public.living_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  recipient_participant_id uuid NOT NULL,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
  description text CHECK(description IS NULL OR length(description) <= 2000),
  cover_asset_id text REFERENCES public.stamp_book_artworks(asset_id),
  approval_policy text NOT NULL DEFAULT 'direct'
    CHECK(approval_policy IN ('direct','approval_required')),
  status text NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','paused','archived')),
  creation_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT living_books_owner_membership_fkey
    FOREIGN KEY(space_id,owner_user_id)
    REFERENCES public.space_members(space_id,user_id),
  CONSTRAINT living_books_recipient_fkey
    FOREIGN KEY(space_id,recipient_participant_id)
    REFERENCES public.participants(space_id,id),
  CONSTRAINT living_books_id_space_key UNIQUE(id,space_id),
  CONSTRAINT living_books_id_recipient_key UNIQUE(id,recipient_participant_id),
  CONSTRAINT living_books_idempotency_key UNIQUE(owner_user_id,creation_key)
);
CREATE UNIQUE INDEX living_books_one_open_direction
  ON public.living_books(space_id,owner_user_id,recipient_participant_id)
  WHERE status IN ('active','paused');
CREATE INDEX living_books_space_recent_idx
  ON public.living_books(space_id,created_at DESC);

CREATE TABLE public.living_book_givers (
  book_id uuid NOT NULL,
  space_id uuid NOT NULL,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(book_id,user_id),
  FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE,
  FOREIGN KEY(space_id,user_id) REFERENCES public.space_members(space_id,user_id)
);
CREATE INDEX living_book_givers_user_idx ON public.living_book_givers(user_id,book_id);

CREATE TABLE public.living_book_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  space_id uuid NOT NULL,
  page_order bigint NOT NULL CHECK(page_order > 0),
  title text CHECK(title IS NULL OR length(title) <= 160),
  background_style text NOT NULL DEFAULT 'cream'
    CHECK(background_style IN ('cream','white','lined','grid','kraft')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  client_key uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT living_book_pages_book_fkey
    FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE,
  CONSTRAINT living_book_pages_book_page_id_key UNIQUE(book_id,id),
  CONSTRAINT living_book_pages_order_unique
    UNIQUE(book_id,page_order) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT living_book_pages_idempotency_unique UNIQUE(book_id,client_key)
);
CREATE INDEX living_book_pages_order_idx ON public.living_book_pages(book_id,page_order);

-- The Data API can read room members' books, but cannot write any Living Book ledger
-- directly. ALL writes must pass through the audited, idempotent versioned RPCs.
ALTER TABLE public.living_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_book_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_book_givers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.living_books, public.living_book_pages,
  public.living_book_givers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.living_books, public.living_book_pages,
  public.living_book_givers TO authenticated;

CREATE POLICY living_books_read_by_members
  ON public.living_books FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.space_members m
    WHERE m.space_id=living_books.space_id AND m.user_id=(SELECT auth.uid())
  ));
CREATE POLICY living_book_pages_read_by_members
  ON public.living_book_pages FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.space_members m
    WHERE m.space_id=living_book_pages.space_id AND m.user_id=(SELECT auth.uid())
  ));
CREATE POLICY living_book_givers_read_by_members
  ON public.living_book_givers FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.space_members m
    WHERE m.space_id=living_book_givers.space_id AND m.user_id=(SELECT auth.uid())
  ));

-- SECURITY DEFINER is intentionally used only for atomic, permission-checked
-- mutations; authenticated clients have no direct table-write grants.
CREATE FUNCTION public.pointplus_create_living_book(
  p_space uuid, p_recipient uuid, p_title text, p_description text,
  p_cover text, p_approval text, p_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_kind text;
  v_recipient public.participants%ROWTYPE;
  v_existing public.living_books%ROWTYPE;
  v_book uuid;
BEGIN
  IF v_uid IS NULL OR p_key IS NULL OR p_space IS NULL OR p_recipient IS NULL
    OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160
    OR length(coalesce(p_description,'')) > 2000
    OR p_approval NOT IN ('direct','approval_required')
  THEN RAISE EXCEPTION 'Invalid Living Book input or authentication' USING ERRCODE='22023'; END IF;
  SELECT m.role INTO v_role FROM public.space_members m
    WHERE m.space_id=p_space AND m.user_id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room membership required' USING ERRCODE='42501'; END IF;
  SELECT s.kind INTO v_kind FROM public.spaces s WHERE s.id=p_space FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found' USING ERRCODE='22023'; END IF;
  IF v_kind <> 'couple' AND v_role NOT IN ('owner','admin')
  THEN RAISE EXCEPTION 'Room administrator required' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_recipient FROM public.participants p
    WHERE p.space_id=p_space AND p.id=p_recipient AND p.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient not found in active room' USING ERRCODE='22023'; END IF;
  IF v_kind='couple' THEN
    IF v_recipient.kind <> 'adult' OR v_recipient.user_id IS NULL
      OR v_recipient.user_id=v_uid OR NOT EXISTS(
        SELECT 1 FROM public.space_members m
        WHERE m.space_id=p_space AND m.user_id=v_recipient.user_id
      )
    THEN RAISE EXCEPTION 'Couple recipient must be the other room member' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_cover IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.stamp_book_artworks a WHERE a.asset_id=p_cover
  ) THEN RAISE EXCEPTION 'Unknown cover artwork' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_existing FROM public.living_books b
    WHERE b.owner_user_id=v_uid AND b.creation_key=p_key;
  IF FOUND THEN
    IF v_existing.space_id IS DISTINCT FROM p_space
      OR v_existing.recipient_participant_id IS DISTINCT FROM p_recipient
      OR v_existing.title IS DISTINCT FROM btrim(p_title)
      OR v_existing.description IS DISTINCT FROM nullif(btrim(p_description),'')
      OR v_existing.cover_asset_id IS DISTINCT FROM p_cover
      OR v_existing.approval_policy IS DISTINCT FROM p_approval
    THEN RAISE EXCEPTION 'Idempotency key reused with different Living Book input' USING ERRCODE='22023'; END IF;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.living_books(
    space_id,owner_user_id,recipient_participant_id,title,description,
    cover_asset_id,approval_policy,creation_key
  ) VALUES (
    p_space,v_uid,p_recipient,btrim(p_title),nullif(btrim(p_description),''),
    p_cover,p_approval,p_key
  ) RETURNING id INTO v_book;
  INSERT INTO public.living_book_givers(book_id,space_id,user_id,granted_by)
    VALUES(v_book,p_space,v_uid,v_uid);
  INSERT INTO public.living_book_pages(
    book_id,space_id,page_order,title,background_style,created_by,client_key
  ) VALUES(v_book,p_space,1,NULL,'cream',v_uid,p_key);
  RETURN v_book;
END $fn$;

CREATE FUNCTION public.pointplus_add_living_book_page(
  p_book uuid, p_key uuid, p_title text DEFAULT NULL, p_background text DEFAULT 'cream'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_book public.living_books%ROWTYPE;
  v_page public.living_book_pages%ROWTYPE;
  v_next bigint;
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_key IS NULL
    OR length(coalesce(p_title,'')) > 160
    OR p_background NOT IN ('cream','white','lined','grid','kraft')
  THEN RAISE EXCEPTION 'Invalid add-page input' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_book FROM public.living_books
    WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id <> v_uid OR v_book.status <> 'active'
    OR NOT EXISTS(SELECT 1 FROM public.space_members m
      WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active Living Book owner may add pages' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_page FROM public.living_book_pages
    WHERE book_id=p_book AND client_key=p_key;
  IF FOUND THEN
    IF v_page.title IS DISTINCT FROM nullif(btrim(p_title),'')
      OR v_page.background_style IS DISTINCT FROM p_background
    THEN RAISE EXCEPTION 'Idempotency key reused with different page input' USING ERRCODE='22023'; END IF;
    RETURN v_page.id;
  END IF;
  SELECT coalesce(max(page_order),0)+1 INTO v_next
    FROM public.living_book_pages WHERE book_id=p_book;
  INSERT INTO public.living_book_pages(
    book_id,space_id,page_order,title,background_style,created_by,client_key
  ) VALUES(p_book,v_book.space_id,v_next,nullif(btrim(p_title),''),p_background,v_uid,p_key)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

CREATE FUNCTION public.pointplus_reorder_living_book_pages(
  p_book uuid, p_page_ids uuid[]
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_book public.living_books%ROWTYPE;
  v_count bigint;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_page_ids IS NULL
  THEN RAISE EXCEPTION 'Invalid reorder input' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_book FROM public.living_books WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id <> v_uid OR v_book.status <> 'active'
    OR NOT EXISTS(SELECT 1 FROM public.space_members m
      WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active Living Book owner may reorder pages' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.living_book_pages WHERE book_id=p_book;
  IF cardinality(p_page_ids) <> v_count OR
    (SELECT count(DISTINCT id) FROM unnest(p_page_ids) AS id) <> v_count OR
    EXISTS(
      SELECT 1 FROM unnest(p_page_ids) AS desired(id)
      WHERE NOT EXISTS(SELECT 1 FROM public.living_book_pages p
        WHERE p.book_id=p_book AND p.id=desired.id)
    )
  THEN RAISE EXCEPTION 'Reorder must contain each book page exactly once' USING ERRCODE='22023'; END IF;
  -- DEFERRABLE unique order permits swapping pages in the same transaction.
  SET CONSTRAINTS public.living_book_pages_order_unique DEFERRED;
  UPDATE public.living_book_pages p SET
    page_order=desired.n,updated_at=now(),version=p.version+1
  FROM unnest(p_page_ids) WITH ORDINALITY AS desired(id,n)
  WHERE p.book_id=p_book AND p.id=desired.id AND p.page_order<>desired.n;
  RETURN v_count::integer;
END $fn$;

CREATE FUNCTION public.pointplus_get_living_book_summary(p_book uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_book public.living_books%ROWTYPE;
DECLARE v_count bigint;
DECLARE v_first uuid;
BEGIN
  IF auth.uid() IS NULL OR p_book IS NULL
  THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_book FROM public.living_books WHERE id=p_book;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.space_members m
    WHERE m.space_id=v_book.space_id AND m.user_id=auth.uid()
  ) THEN RAISE EXCEPTION 'Living Book not found or unavailable' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.living_book_pages p WHERE p.book_id=p_book;
  SELECT p.id INTO v_first FROM public.living_book_pages p
    WHERE p.book_id=p_book ORDER BY p.page_order LIMIT 1;
  RETURN jsonb_build_object(
    'id',v_book.id,'space_id',v_book.space_id,'owner_user_id',v_book.owner_user_id,
    'recipient_participant_id',v_book.recipient_participant_id,
    'title',v_book.title,'status',v_book.status,'page_count',v_count,
    'first_page_id',v_first,'unlimited_stamps',true,'auto_archive',false
  );
END $fn$;

REVOKE ALL ON FUNCTION public.pointplus_create_living_book(
  uuid,uuid,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pointplus_add_living_book_page(
  uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pointplus_reorder_living_book_pages(
  uuid,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pointplus_get_living_book_summary(
  uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_create_living_book(
  uuid,uuid,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_add_living_book_page(
  uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_reorder_living_book_pages(
  uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_get_living_book_summary(
  uuid) TO authenticated;

COMMIT;
