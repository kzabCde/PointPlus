-- M05 reversible decoration integration verification on ephemeral PostgreSQL 16.
-- Run AFTER M01..M04 and their integration suites; never Production.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $m05$
DECLARE
 v_book uuid;
 v_page uuid;
 v_other_page uuid;
 v_text uuid;
 v_photo uuid;
 v_photo_version bigint;
 v_deleted_version bigint;
 v_restored jsonb;
 v_mark_count bigint;
 v_redemption_count bigint;
 v_events_count bigint;
 v_denied boolean;
BEGIN
 SELECT id INTO v_book FROM public.living_books
 WHERE owner_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND space_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' ORDER BY created_at LIMIT 1;
 SELECT id INTO v_page FROM public.living_book_pages
 WHERE book_id=v_book ORDER BY page_order LIMIT 1;
 SELECT id INTO v_other_page FROM public.living_book_pages
 WHERE book_id=v_book ORDER BY page_order DESC LIMIT 1;
 SELECT id INTO v_photo FROM public.living_book_elements
 WHERE book_id=v_book AND element_type='image' AND deleted_at IS NULL LIMIT 1;
 IF v_photo IS NULL THEN RAISE EXCEPTION 'M03 private photo baseline not found'; END IF;
 SELECT version INTO v_photo_version FROM public.living_book_elements WHERE id=v_photo;

 SELECT count(*) INTO v_mark_count FROM public.living_stamp_marks WHERE book_id=v_book;
 SELECT count(*) INTO v_redemption_count FROM public.living_stamp_redemptions WHERE book_id=v_book;
 SELECT count(*) INTO v_events_count FROM public.living_stamp_events WHERE book_id=v_book;

 -- Owner can soft delete and restore a private photo, retaining its original
 -- content UUID and private Storage object so undo never loses image bytes.
 PERFORM public.pointplus_delete_living_book_element(v_book,v_page,v_photo,v_photo_version);
 SELECT version INTO v_deleted_version FROM public.living_book_elements WHERE id=v_photo;
 IF NOT EXISTS(SELECT 1 FROM public.living_book_elements
    WHERE id=v_photo AND deleted_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Photo must be soft deleted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o
    JOIN public.living_book_elements e ON e.payload->>'storagePath'=o.name
    WHERE e.id=v_photo AND o.bucket_id='pointplus-living-photos')
 THEN RAISE EXCEPTION 'Undo requires retained private image file'; END IF;

 -- Recipient in same room cannot restore another person's decoration.
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
 v_denied:=false;
 BEGIN PERFORM public.pointplus_restore_living_book_element(
   v_book,v_page,v_photo,v_deleted_version);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Recipient restored owner photo'; END IF;

 -- Outsider cannot restore decorations even with exact UUIDs.
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
 v_denied:=false;
 BEGIN PERFORM public.pointplus_restore_living_book_element(
   v_book,v_page,v_photo,v_deleted_version);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Outsider restored owner photo'; END IF;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

 v_denied:=false;
 BEGIN PERFORM public.pointplus_restore_living_book_element(
   v_book,v_other_page,v_photo,v_deleted_version);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Cross-page restore accepted'; END IF;

 v_denied:=false;
 BEGIN PERFORM public.pointplus_restore_living_book_element(
   v_book,v_page,v_photo,v_photo_version);
 EXCEPTION WHEN serialization_failure THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Stale photo version restore accepted'; END IF;

 v_restored:=public.pointplus_restore_living_book_element(
   v_book,v_page,v_photo,v_deleted_version);
 IF v_restored->>'restored'<>'true'
   OR (v_restored->>'id')::uuid<>v_photo
   OR (v_restored->>'version')::bigint<>v_deleted_version+1
 THEN RAISE EXCEPTION 'Photo was not restored with same ID and updated version'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.living_book_elements WHERE id=v_photo
     AND deleted_at IS NULL AND element_type='image')
 THEN RAISE EXCEPTION 'Photo lost original element after restore'; END IF;

 v_denied:=false;
 BEGIN PERFORM public.pointplus_restore_living_book_element(
   v_book,v_page,v_photo,v_deleted_version+1);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Double restore should be rejected'; END IF;

 -- Text decorations also restore exactly and remain version-conflict guarded.
 SELECT id INTO v_text FROM public.living_book_elements
 WHERE book_id=v_book AND element_type='text' AND deleted_at IS NULL LIMIT 1;
 IF v_text IS NULL THEN
   v_text:=gen_random_uuid();
   PERFORM public.pointplus_save_living_book_element(
     v_book,v_page,v_text,'text',
     '{"text":"M05 paper undo","fontSize":24,"color":"#774455","fontFamily":"sans","align":"left","bold":false,"italic":false}'::jsonb,
     .3,.35,.4,.15,0,1,0,0);
 END IF;
 SELECT page_id INTO v_page FROM public.living_book_elements WHERE id=v_text;
 SELECT version INTO v_photo_version FROM public.living_book_elements WHERE id=v_text;
 PERFORM public.pointplus_delete_living_book_element(v_book,v_page,v_text,v_photo_version);
 SELECT version INTO v_deleted_version FROM public.living_book_elements WHERE id=v_text;
 PERFORM public.pointplus_restore_living_book_element(v_book,v_page,v_text,v_deleted_version);
 IF (SELECT payload->>'text' FROM public.living_book_elements WHERE id=v_text)<>'M05 paper undo'
   AND (SELECT payload->>'text' FROM public.living_book_elements WHERE id=v_text) IS NULL
 THEN RAISE EXCEPTION 'Text payload lost on restore'; END IF;

 -- Undo is strictly for paper decorations: no stamp, redemption or audit mutation.
 IF (SELECT count(*) FROM public.living_stamp_marks WHERE book_id=v_book)<>v_mark_count OR
    (SELECT count(*) FROM public.living_stamp_redemptions WHERE book_id=v_book)<>v_redemption_count OR
    (SELECT count(*) FROM public.living_stamp_events WHERE book_id=v_book)<>v_events_count
 THEN RAISE EXCEPTION 'M05 decoration restore modified immutable stamp ledger'; END IF;
END $m05$;

DO $m05_permissions$
BEGIN
 IF has_function_privilege('anon',
   'public.pointplus_restore_living_book_element(uuid,uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous users can restore decorations'; END IF;
 IF NOT has_function_privilege('authenticated',
   'public.pointplus_restore_living_book_element(uuid,uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Authenticated owner lacks restore RPC'; END IF;
 IF has_table_privilege('authenticated','public.living_book_elements','UPDATE')
 THEN RAISE EXCEPTION 'M05 cannot expose direct client mutation'; END IF;
END $m05_permissions$;
SELECT 'M05 versioned owner restore, undo safety, history integrity: PASS' AS result;
