-- M03 PostgreSQL 16 integration test, AFTER baseline, M01, M02, M03, M02 tests.
-- All work is against disposable CI database; no Supabase Production data.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $m03$
DECLARE
 v_book uuid;
 v_page uuid;
 v_photo uuid:='12121212-1212-4121-8121-121212121212';
 v_path text;
 v_receipt jsonb;
 v_request uuid;
 v_mark uuid;
 v_next uuid;
 v_pending uuid;
 v_pending_mark uuid;
 v_book_b uuid;
 v_page_b uuid;
 v_old_page uuid;
 v_version bigint;
 v_denied boolean;
BEGIN
 SELECT id INTO v_book FROM public.living_books WHERE owner_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ORDER BY created_at LIMIT 1;
 IF v_book IS NULL THEN RAISE EXCEPTION 'M02 test did not create a Living Book'; END IF;
 SELECT id INTO v_page FROM public.living_book_pages WHERE book_id=v_book ORDER BY page_order LIMIT 1;
 SELECT id INTO v_old_page FROM public.living_book_pages WHERE book_id=v_book ORDER BY page_order DESC LIMIT 1;
 v_path:='dddddddd-dddd-4ddd-8ddd-dddddddddddd/'||v_book::text||'/'||v_page::text||'/'||v_photo::text||'.png';
 INSERT INTO storage.objects(bucket_id,name) VALUES('pointplus-living-photos',v_path);
 v_receipt:=public.pointplus_create_living_book_image(v_book,v_page,v_photo,v_path,'image/png',640,480);
 IF (v_receipt->>'version')::int<>1
 THEN RAISE EXCEPTION 'Photo insert version incorrect'; END IF;
 IF (SELECT count(*) FROM public.living_book_elements WHERE id=v_photo AND element_type='image')<>1
 THEN RAISE EXCEPTION 'Photo not created as a decorative element'; END IF;
 v_receipt:=public.pointplus_create_living_book_image(v_book,v_page,v_photo,v_path,'image/png',640,480);
 IF (v_receipt->>'id')::uuid<>v_photo THEN RAISE EXCEPTION 'Photo retry must be idempotent'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_create_living_book_image(v_book,v_old_page,gen_random_uuid(),v_path,'image/png',640,480);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Wrong page/photo path allowed'; END IF;
 v_receipt:=public.pointplus_transform_living_book_image(
  v_book,v_page,v_photo,.2,.3,.4,.5,45,.9,201,
  '{"x":0.1,"y":0.1,"width":0.8,"height":0.8}'::jsonb,1);
 IF (v_receipt->>'version')::int<>2 THEN RAISE EXCEPTION 'Photo transform failed'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_transform_living_book_image(
   v_book,v_page,v_photo,.2,.3,.4,.5,0,1,202,
   '{"x":0.8,"y":0.8,"width":0.8,"height":0.8}'::jsonb,2);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Out-of-bounds crop accepted'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_transform_living_book_image(
   v_book,v_page,v_photo,.2,.3,.4,.5,0,1,202,
   '{"x":0,"y":0,"width":1,"height":1}'::jsonb,1);
 EXCEPTION WHEN serialization_failure THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Stale photo write must fail'; END IF;

 v_receipt:=public.pointplus_give_living_stamp(
  v_book,v_page,'heart','First memory','11111111-1111-4111-8111-111111111111',
  .2,.3,-145,1.8);
 IF v_receipt->>'status'<>'approved'
 THEN RAISE EXCEPTION 'Direct stamp was not approved'; END IF;
 v_request:=(v_receipt->>'request_id')::uuid;
 v_mark:=(v_receipt->>'mark_id')::uuid;
 IF v_mark IS NULL OR (SELECT count(*) FROM public.living_stamp_marks WHERE id=v_mark AND state='available')<>1
 THEN RAISE EXCEPTION 'Direct stamp must create one available mark'; END IF;
 IF (SELECT count(*) FROM public.living_stamp_events WHERE mark_id=v_mark AND event_type='granted')<>1
 THEN RAISE EXCEPTION 'Direct stamp missing granted event'; END IF;
 v_receipt:=public.pointplus_give_living_stamp(
  v_book,v_page,'heart','First memory','11111111-1111-4111-8111-111111111111',
  .2,.3,-145,1.8);
 IF (v_receipt->>'mark_id')::uuid<>v_mark OR
   (SELECT count(*) FROM public.living_stamp_marks WHERE request_id=v_request)<>1
 THEN RAISE EXCEPTION 'Idempotent direct retry created a duplicate stamp'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_give_living_stamp(
   v_book,v_page,'heart','DIFFERENT','11111111-1111-4111-8111-111111111111',
   .2,.3,-145,1.8);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Mismatched idempotency retry must fail'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_give_living_stamp(
   v_book,gen_random_uuid(),'heart','Invalid','22222222-2222-4222-8222-222222222222',
   .3,.3,0,1);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Cross-page stamp grant allowed'; END IF;
 v_receipt:=public.pointplus_transform_living_stamp(v_mark,v_old_page,.77,.22,176,2.4,1);
 IF v_receipt->>'version'<>'2' THEN RAISE EXCEPTION 'Stamp transform did not advance version'; END IF;
 IF (SELECT page_id FROM public.living_stamp_marks WHERE id=v_mark)<>v_old_page
 THEN RAISE EXCEPTION 'Stamp did not move to target page'; END IF;
 IF (SELECT count(*) FROM public.living_stamp_events WHERE mark_id=v_mark AND event_type='transformed')<>1
 THEN RAISE EXCEPTION 'Stamp transform event missing'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_transform_living_stamp(v_mark,v_page,.1,.1,0,1,1);
 EXCEPTION WHEN serialization_failure THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Stale stamp transform accepted'; END IF;
 v_receipt:=public.pointplus_peel_living_stamp(v_mark,2);
 IF v_receipt->>'state'<>'peeled' THEN RAISE EXCEPTION 'Peel failed'; END IF;
 IF (SELECT count(*) FROM public.living_stamp_marks WHERE id=v_mark AND state='peeled'
     AND peeled_at IS NOT NULL AND peeled_by IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'Peeled stamp must retain permanent paper trace'; END IF;
 IF (SELECT count(*) FROM public.living_stamp_events WHERE mark_id=v_mark AND event_type='peeled')<>1
 THEN RAISE EXCEPTION 'Peeling must append immutable event'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_peel_living_stamp(v_mark,3);
 EXCEPTION WHEN serialization_failure THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Duplicate peeling allowed'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_transform_living_stamp(v_mark,v_page,.2,.2,0,1,3);
 EXCEPTION WHEN invalid_parameter_value THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Peeled stamp can be transformed'; END IF;
 IF (SELECT count(*) FROM public.living_books WHERE id=v_book AND status='active')<>1
 THEN RAISE EXCEPTION 'Peeling unexpectedly archived book'; END IF;

 -- B creates own book for A; A is independent reviewer of B's stamps.
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
 v_book_b:=public.pointplus_create_living_book(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','ffffffff-ffff-4fff-8fff-ffffffffffff',
  'B to A living','', 'heart','approval_required',
  '77777777-7777-4777-8777-777777777777');
 SELECT id INTO v_page_b FROM public.living_book_pages WHERE book_id=v_book_b;
 v_receipt:=public.pointplus_give_living_stamp(v_book_b,v_page_b,'heart','Pending A approval',
  '88888888-8888-4888-8888-888888888888',.4,.45,0,1);
 IF v_receipt->>'status'<>'pending' OR (v_receipt->>'mark_id') IS NOT NULL
 THEN RAISE EXCEPTION 'Approval-required book must not mint a mark before review'; END IF;
 v_pending:=(v_receipt->>'request_id')::uuid;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_review_living_stamp(v_pending,true);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Giver self-approval was allowed'; END IF;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
 v_receipt:=public.pointplus_review_living_stamp(v_pending,true);
 v_pending_mark:=(v_receipt->>'mark_id')::uuid;
 IF v_pending_mark IS NULL OR v_receipt->>'status'<>'approved'
 THEN RAISE EXCEPTION 'Recipient failed to approve own pending stamp'; END IF;
 IF (SELECT count(*) FROM public.living_stamp_marks WHERE request_id=v_pending)<>1
 THEN RAISE EXCEPTION 'Approved request should mint exactly one mark'; END IF;

 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
 v_receipt:=public.pointplus_give_living_stamp(v_book_b,v_page_b,'heart','Cancel',
  '99999999-9999-4999-8999-999999999990',.2,.2,0,1);
 v_next:=(v_receipt->>'request_id')::uuid;
 PERFORM public.pointplus_cancel_living_stamp_request(v_next);
 IF (SELECT status FROM public.living_stamp_requests WHERE id=v_next)<>'canceled'
 THEN RAISE EXCEPTION 'Cancellation not saved'; END IF;
 IF EXISTS(SELECT 1 FROM public.living_stamp_marks WHERE request_id=v_next)
 THEN RAISE EXCEPTION 'Canceled request must not mint a mark'; END IF;
 v_receipt:=public.pointplus_give_living_stamp(v_book_b,v_page_b,'heart','Reject',
  '99999999-9999-4999-8999-999999999991',.3,.3,0,1);
 v_next:=(v_receipt->>'request_id')::uuid;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
 PERFORM public.pointplus_review_living_stamp(v_next,false);
 IF EXISTS(SELECT 1 FROM public.living_stamp_marks WHERE request_id=v_next)
 THEN RAISE EXCEPTION 'Rejected request must not mint a mark'; END IF;

 -- outsider cannot mint or edit real stamps
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','outsider',
   gen_random_uuid(),.3,.3,0,1);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Outsider can give stamp'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.pointplus_create_living_book_image(v_book,v_page,gen_random_uuid(),v_path,
   'image/png',640,480);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Outsider can create photo'; END IF;
END $m03$;

DO $grants$
DECLARE v_fn text;
BEGIN
 FOREACH v_fn IN ARRAY ARRAY[
 'public.pointplus_give_living_stamp(uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric)',
 'public.pointplus_review_living_stamp(uuid,boolean)',
 'public.pointplus_transform_living_stamp(uuid,uuid,numeric,numeric,numeric,numeric,bigint)',
 'public.pointplus_peel_living_stamp(uuid,bigint)',
 'public.pointplus_create_living_book_image(uuid,uuid,uuid,text,text,integer,integer)'
 ] LOOP
  IF has_function_privilege('anon',v_fn,'EXECUTE')
    OR NOT has_function_privilege('authenticated',v_fn,'EXECUTE')
  THEN RAISE EXCEPTION 'Invalid EXECUTE grants on %',v_fn; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.living_stamp_marks','INSERT')
  OR has_table_privilege('authenticated','public.living_stamp_marks','UPDATE')
  OR has_table_privilege('authenticated','public.living_stamp_marks','DELETE')
 THEN RAISE EXCEPTION 'Stamp ledger cannot be mutated directly'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.living_stamp_marks'::regclass)
 THEN RAISE EXCEPTION 'Stamp ledger RLS missing'; END IF;
END $grants$;

SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
SET ROLE authenticated;
DO $outsider$
BEGIN
 IF (SELECT count(*) FROM public.living_stamp_marks)<>0 OR
    (SELECT count(*) FROM public.living_stamp_requests)<>0 OR
    (SELECT count(*) FROM public.living_stamp_events)<>0 OR
    (SELECT count(*) FROM storage.objects WHERE bucket_id='pointplus-living-photos')<>0
 THEN RAISE EXCEPTION 'Outsider can see room stamp/media data'; END IF;
END $outsider$;
RESET ROLE;
SELECT 'M03 private photo, stamp issuance, approval, peel, transform and RLS: PASS' AS result;
