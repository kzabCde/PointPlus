-- Executed only against ephemeral CI PostgreSQL after M01–M05 and the card migration.
DO $card$
DECLARE
  v_book uuid;v_repeat uuid;v_second uuid;v_reverse uuid;
  v_page uuid;v_mark jsonb;v_claim jsonb;v_count integer;
  v_room uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_to_b uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_to_a uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v_a::text,true);
 v_book:=public.pointplus_create_living_card(v_room,v_to_b,'Card A to B',null,
  'heart','direct','11111111-1111-4111-8111-111111111111',4,'Picnic');
 v_repeat:=public.pointplus_create_living_card(v_room,v_to_b,'Card A to B',null,
  'heart','direct','11111111-1111-4111-8111-111111111111',4,'Picnic');
 IF v_book<>v_repeat THEN RAISE EXCEPTION 'Creation idempotency failed'; END IF;
 SELECT count(*) INTO v_count FROM public.living_book_pages WHERE book_id=v_book;
 IF v_count<>1 THEN RAISE EXCEPTION 'Card must create exactly one page'; END IF;
 SELECT count(*) INTO v_count FROM public.living_book_givers WHERE book_id=v_book AND user_id=v_a;
 IF v_count<>1 THEN RAISE EXCEPTION 'Only owner can initially give stamps'; END IF;
 -- A second collection in the same direction is now permitted without deleting old data.
 v_second:=public.pointplus_create_living_book(v_room,v_to_b,'Second memories',null,
  'heart','direct','22222222-2222-4222-8222-222222222222');
 IF v_second=v_book THEN RAISE EXCEPTION 'Distinct key must create a distinct collection'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_b::text,true);
 v_reverse:=public.pointplus_create_living_card(v_room,v_to_a,'Card B to A',null,
  'heart','direct','33333333-3333-4333-8333-333333333333',4,'Dinner');
 IF v_reverse=v_book THEN RAISE EXCEPTION 'Reverse direction failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_a::text,true);
 SELECT id INTO v_page FROM public.living_book_pages WHERE book_id=v_book;
 v_mark:=public.pointplus_give_living_stamp(v_book,v_page,'heart','',
   '44444444-4444-4444-8444-444444444444',0.25,0.25,0,0.7);
 IF v_mark->>'status'<>'approved' THEN RAISE EXCEPTION 'Card slot issuance failed'; END IF;
 v_mark:=public.pointplus_give_living_stamp(v_book,v_page,'heart','',
   '44444444-4444-4444-8444-444444444444',0.25,0.25,0,0.7);
 SELECT count(*) INTO v_count FROM public.living_stamp_marks WHERE book_id=v_book;
 IF v_count<>1 THEN RAISE EXCEPTION 'Duplicate request created a second mark'; END IF;
 BEGIN
  PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','',
   '55555555-5555-4555-8555-555555555555',0.25,0.25,0,0.7);
  RAISE EXCEPTION 'A second mark used the occupied slot';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','',
   '66666666-6666-4666-8666-666666666666',0.3,0.3,0,0.7);
  RAISE EXCEPTION 'Accepted an off-grid stamp';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 -- Target cannot be redeemed after a single earned mark.
 PERFORM set_config('request.jwt.claim.sub',v_b::text,true);
 BEGIN
  PERFORM public.pointplus_request_living_stamp_redemption(v_book,1,'Picnic',
    '77777777-7777-4777-8777-777777777777');
  RAISE EXCEPTION 'Partial card redemption was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_a::text,true);
 PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','',
  '88888888-8888-4888-8888-888888888888',0.75,0.25,0,0.7);
 PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','',
  '99999999-9999-4999-8999-999999999999',0.25,0.75,0,0.7);
 PERFORM public.pointplus_give_living_stamp(v_book,v_page,'heart','',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',0.75,0.75,0,0.7);
 PERFORM set_config('request.jwt.claim.sub',v_b::text,true);
 v_claim:=public.pointplus_request_living_stamp_redemption(v_book,4,'Picnic',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc');
 IF v_claim->>'status'<>'requested' OR (v_claim->>'quantity')::integer<>4
 THEN RAISE EXCEPTION 'Full-card redemption failed'; END IF;
 SELECT count(*) INTO v_count FROM public.living_stamp_marks WHERE book_id=v_book AND state='reserved';
 IF v_count<>4 THEN RAISE EXCEPTION 'Expected four reserved ledger marks'; END IF;
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
 BEGIN
  PERFORM public.pointplus_create_living_card(v_room,v_to_b,'Unauthorized',null,
   'heart','direct','cccccccc-cccc-4ccc-8ccc-cccccccccccd',4,'Wrong');
  RAISE EXCEPTION 'Unauthorized user could create card';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $card$;

-- No anonymous mutation grant. Exposed new table remains read-only.
DO $grants$
BEGIN
 IF has_function_privilege('anon',
   'public.pointplus_create_living_card(uuid,uuid,text,text,text,text,uuid,integer,text)',
   'EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC EXECUTE must be revoked'; END IF;
 IF has_table_privilege('authenticated','public.living_book_cards','INSERT')
 THEN RAISE EXCEPTION 'Direct card configuration INSERT must be forbidden'; END IF;
END $grants$;
