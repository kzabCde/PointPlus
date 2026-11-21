-- POINT+ Living Stampbook V3 — M05 Reliable reversible paper edits.
-- Additive after 16 (M01), 17 (M02), 18 (M03), 19 (M04).
-- No changes to stamp balance, redemption, or immutable stamp history.
-- DO NOT APPLY TO PRODUCTION BEFORE FINAL RELEASE AUTHORIZATION.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $m05_preflight$
BEGIN
  IF to_regclass('public.living_book_elements') IS NULL
     OR to_regprocedure('public.pointplus_delete_living_book_element(uuid,uuid,uuid,bigint)') IS NULL
  THEN RAISE EXCEPTION 'Living Stampbook M01–M04 prerequisites must exist'; END IF;
  IF to_regprocedure('public.pointplus_restore_living_book_element(uuid,uuid,uuid,bigint)') IS NOT NULL
  THEN RAISE EXCEPTION 'M05 restore RPC already installed; do not replay'; END IF;
END $m05_preflight$;

-- Undo of a deleted decorative object restores the SAME ID and versioned
-- text, drawing or photo payload. Never restores peeled/redeemed stamps.
-- Storage photos are retained on soft deletion for successful Undo.
CREATE FUNCTION public.pointplus_restore_living_book_element(
  p_book uuid,p_page uuid,p_element uuid,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_book public.living_books%ROWTYPE;
  v_element public.living_book_elements%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_book IS NULL OR p_page IS NULL OR p_element IS NULL
     OR p_expected_version IS NULL OR p_expected_version<1
  THEN RAISE EXCEPTION 'Invalid restoration request' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_book FROM public.living_books
  WHERE id=p_book FOR UPDATE;
  IF NOT FOUND OR v_book.owner_user_id<>v_uid OR v_book.status<>'active'
     OR NOT EXISTS(SELECT 1 FROM public.space_members m
         WHERE m.space_id=v_book.space_id AND m.user_id=v_uid)
  THEN RAISE EXCEPTION 'Only the active book owner may restore paper decoration'
       USING ERRCODE='42501'; END IF;

  SELECT * INTO v_element FROM public.living_book_elements
  WHERE id=p_element AND book_id=p_book AND page_id=p_page FOR UPDATE;
  IF NOT FOUND OR v_element.deleted_at IS NULL
  THEN RAISE EXCEPTION 'Decoration is not deleted on this page'
       USING ERRCODE='22023'; END IF;
  IF v_element.version<>p_expected_version
  THEN RAISE EXCEPTION 'Decoration version conflict; reload before restoring'
       USING ERRCODE='40001'; END IF;
  IF v_element.element_type NOT IN ('text','drawing','image')
  THEN RAISE EXCEPTION 'Not a reversible decoration' USING ERRCODE='22023'; END IF;

  -- An image may be restored only when its private backing file remains.
  IF v_element.element_type='image'
     AND NOT EXISTS(
       SELECT 1 FROM storage.objects o
       WHERE o.bucket_id='pointplus-living-photos'
         AND o.name=v_element.payload->>'storagePath'
     )
  THEN RAISE EXCEPTION 'Image backing file was removed and cannot be restored'
       USING ERRCODE='22023'; END IF;

  UPDATE public.living_book_elements
  SET deleted_at=NULL,version=version+1,updated_at=now()
  WHERE id=p_element
  RETURNING * INTO v_element;
  RETURN jsonb_build_object('id',v_element.id,'version',v_element.version,
     'restored',true);
END $fn$;

REVOKE ALL ON FUNCTION public.pointplus_restore_living_book_element(
 uuid,uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_restore_living_book_element(
 uuid,uuid,uuid,bigint) TO authenticated;
COMMIT;
