-- M04 real PostgreSQL 16 integration contract, run AFTER M01→M04 and M02/M03 assertions.
-- Existing fixture: A is owner of book A→B with a peeled stamp. B also owns
-- an approval-required B→A book with one approved stamp.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

DO $m04$
DECLARE
  v_book uuid; v_page uuid; v_book_b uuid;
  v_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_out uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_receipt jsonb; v_redemption uuid; v_replay jsonb;
  v_cancel uuid; v_next uuid; v_reverse uuid;
  v_eligible integer; v_reserved integer; v_redeemed integer;
  v_mark uuid; v_stale boolean; v_recipient_mark uuid;
  v_keys uuid[]; v_mark_ids jsonb; v_balance jsonb;
  v_before bigint;
BEGIN
  SELECT id INTO v_book FROM public.living_books WHERE owner_user_id=v_a LIMIT 1;
  SELECT id INTO v_book_b FROM public.living_books WHERE owner_user_id=v_b LIMIT 1;
  SELECT id INTO v_page FROM public.living_book_pages WHERE book_id=v_book ORDER BY page_order LIMIT 1;
  IF v_book IS NULL OR v_book_b IS NULL OR v_page IS NULL
  THEN RAISE EXCEPTION 'M03 integration baseline is missing two-way books'; END IF;
  FOR v_eligible IN 1..12 LOOP
    v_receipt:=public.pointplus_give_living_stamp(
      v_book,v_page,'heart','m04 issued stamp',gen_random_uuid(),
      0.25,0.4,0,1
    );
    IF v_receipt->>'status'<>'approved' OR v_receipt->>'mark_id' IS NULL
    THEN RAISE EXCEPTION 'Expected M04 direct stamp %',v_eligible; END IF;
  END LOOP;
  v_balance:=public.pointplus_get_living_stamp_balance(v_book);
  IF (v_balance->>'total')::integer<>13
    OR (v_balance->>'available')::integer<>12
    OR (v_balance->>'peeled')::integer<>1
    OR (v_balance->>'reserved')::integer<>0
    OR (v_balance->>'redeemed')::integer<>0
  THEN RAISE EXCEPTION 'Initial stamp counts incorrect: %',v_balance; END IF;

  -- Only recipient B can choose the quantity/reward. Creator A cannot self-redeem.
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_request_living_stamp_redemption(
      v_book,1,'not allowed',gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Creator self-redeemption must be denied'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_b::text,false);

  v_receipt:=public.pointplus_request_living_stamp_redemption(
    v_book,5,'ปิกนิกด้วยกัน','12345678-1234-4234-8234-123456789abc');
  v_redemption:=(v_receipt->>'id')::uuid;
  v_mark_ids:=v_receipt->'mark_ids';
  IF v_redemption IS NULL OR v_receipt->>'status'<>'requested'
    OR (v_receipt->>'quantity')::integer<>5
    OR jsonb_array_length(v_mark_ids)<>5
  THEN RAISE EXCEPTION 'Five-stamp redemption receipt invalid: %',v_receipt; END IF;
  IF (SELECT count(*) FROM public.living_stamp_redemption_marks
       WHERE redemption_id=v_redemption)<>5
    OR (SELECT count(*) FROM public.living_stamp_marks
       WHERE book_id=v_book AND state='reserved' AND redemption_id=v_redemption)<>5
  THEN RAISE EXCEPTION 'Exactly five stamps must be atomically reserved'; END IF;
  v_balance:=public.pointplus_get_living_stamp_balance(v_book);
  IF (v_balance->>'available')::integer<>7 OR (v_balance->>'reserved')::integer<>5
  THEN RAISE EXCEPTION 'Reservation changed wrong balance: %',v_balance; END IF;

  -- Retries are idempotent; can never reserve five additional marks.
  v_replay:=public.pointplus_request_living_stamp_redemption(
    v_book,5,'ปิกนิกด้วยกัน','12345678-1234-4234-8234-123456789abc');
  IF (v_replay->>'id')::uuid<>v_redemption
    OR jsonb_array_length(v_replay->'mark_ids')<>5
    OR (SELECT count(*) FROM public.living_stamp_redemptions WHERE book_id=v_book)<>1
  THEN RAISE EXCEPTION 'Redemption replay minted duplicate reservation'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_request_living_stamp_redemption(
      v_book,6,'different','12345678-1234-4234-8234-123456789abc');
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Idempotency key mutation accepted'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_request_living_stamp_redemption(
      v_book,8,'too many',gen_random_uuid());
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Overspending unreserved stamps accepted'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_request_living_stamp_redemption(
      v_book,0,'invalid',gen_random_uuid());
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Zero stamp reward accepted'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_request_living_stamp_redemption(
      v_book,1,'   ',gen_random_uuid());
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Empty reward accepted'; END IF;

  -- The recipient has no authority to fulfill or cancel requests.
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_fulfill_living_stamp_redemption(v_redemption);
  EXCEPTION WHEN insufficient_privilege THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Recipient self-fulfillment allowed'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_cancel_living_stamp_redemption(v_redemption);
  EXCEPTION WHEN insufficient_privilege THEN v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Recipient self-cancellation allowed'; END IF;

  -- Owner cannot peel or transform reserved stamps, even at the current version.
  SELECT id INTO v_mark FROM public.living_stamp_marks WHERE redemption_id=v_redemption LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_a::text,false);
  v_stale:=false;
  BEGIN PERFORM public.pointplus_peel_living_stamp(v_mark,2);
  EXCEPTION WHEN serialization_failure THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Reserved stamp peeled'; END IF;
  v_stale:=false;
  BEGIN
    PERFORM public.pointplus_transform_living_stamp(v_mark,v_page,.2,.2,0,1,2);
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Reserved stamp transformed'; END IF;

  v_receipt:=public.pointplus_fulfill_living_stamp_redemption(v_redemption);
  IF v_receipt->>'status'<>'fulfilled' OR
    (SELECT count(*) FROM public.living_stamp_marks
       WHERE redemption_id=v_redemption AND state='redeemed'
         AND redeemed_at IS NOT NULL)<>5
  THEN RAISE EXCEPTION 'Fulfillment must mark exactly five used stamps'; END IF;
  IF (SELECT count(*) FROM public.living_stamp_events
       WHERE event_type='redeemed' AND details->>'redemption_id'=v_redemption::text)<>5
  THEN RAISE EXCEPTION 'Redeemed stamps lack immutable events'; END IF;
  IF (SELECT count(*) FROM public.living_stamp_redemptions
       WHERE id=v_redemption AND status='fulfilled' AND fulfilled_by=v_a
         AND fulfilled_at IS NOT NULL)<>1
  THEN RAISE EXCEPTION 'Fulfilled request history incomplete'; END IF;
  v_before:=(SELECT count(*) FROM public.living_stamp_events WHERE event_type='redeemed');
  PERFORM public.pointplus_fulfill_living_stamp_redemption(v_redemption);
  IF (SELECT count(*) FROM public.living_stamp_events WHERE event_type='redeemed')<>v_before
  THEN RAISE EXCEPTION 'Double fulfillment emitted duplicate events'; END IF;
  v_stale:=false;
  BEGIN PERFORM public.pointplus_cancel_living_stamp_redemption(v_redemption);
  EXCEPTION WHEN invalid_parameter_value THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Redeemed stamps re-credited by cancellation'; END IF;
  v_stale:=false;
  BEGIN PERFORM public.pointplus_peel_living_stamp(v_mark,3);
  EXCEPTION WHEN serialization_failure THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Spent stamps can be peeled'; END IF;

  -- A fulfilled request leaves the same book ACTIVE and newly given stamps valid.
  IF (SELECT status FROM public.living_books WHERE id=v_book)<>'active'
  THEN RAISE EXCEPTION 'Fulfillment must not archive Living Book'; END IF;
  v_receipt:=public.pointplus_give_living_stamp(
    v_book,v_page,'heart','after first fulfillment',gen_random_uuid(),
    .33,.31,33,1);
  IF v_receipt->>'status'<>'approved'
  THEN RAISE EXCEPTION 'Cannot issue new stamps after redemption'; END IF;

  -- User B can reserve seven of the eight available; owner cancels and
  -- precisely those stamps become available again, association history stays.
  PERFORM set_config('request.jwt.claim.sub',v_b::text,false);
  v_receipt:=public.pointplus_request_living_stamp_redemption(
    v_book,7,'Cancelable reward',gen_random_uuid());
  v_cancel:=(v_receipt->>'id')::uuid;
  IF (SELECT count(*) FROM public.living_stamp_redemption_marks WHERE redemption_id=v_cancel)<>7
  THEN RAISE EXCEPTION 'Seven-stamp reservation count incorrect'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_a::text,false);
  v_receipt:=public.pointplus_cancel_living_stamp_redemption(v_cancel);
  IF v_receipt->>'status'<>'canceled'
    OR (SELECT count(*) FROM public.living_stamp_marks WHERE redemption_id=v_cancel)<>0
    OR (SELECT count(*) FROM public.living_stamp_redemption_marks WHERE redemption_id=v_cancel)<>7
  THEN RAISE EXCEPTION 'Cancellation must release only seven stamps and retain history'; END IF;
  IF (SELECT count(*) FROM public.living_stamp_events
      WHERE event_type='released' AND details->>'redemption_id'=v_cancel::text)<>7
  THEN RAISE EXCEPTION 'Cancellation release history incomplete'; END IF;
  v_before:=(SELECT count(*) FROM public.living_stamp_events WHERE event_type='released');
  PERFORM public.pointplus_cancel_living_stamp_redemption(v_cancel);
  IF (SELECT count(*) FROM public.living_stamp_events WHERE event_type='released')<>v_before
  THEN RAISE EXCEPTION 'Duplicate cancellation emitted extra releases'; END IF;
  v_balance:=public.pointplus_get_living_stamp_balance(v_book);
  IF (v_balance->>'available')::integer<>8
    OR (v_balance->>'reserved')::integer<>0
    OR (v_balance->>'redeemed')::integer<>5
    OR (v_balance->>'peeled')::integer<>1
  THEN RAISE EXCEPTION 'Cancellation restored wrong counts: %',v_balance; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_b::text,false);
  v_receipt:=public.pointplus_request_living_stamp_redemption(
    v_book,1,'Second fulfillment',gen_random_uuid());
  v_next:=(v_receipt->>'id')::uuid;
  PERFORM set_config('request.jwt.claim.sub',v_a::text,false);
  PERFORM public.pointplus_fulfill_living_stamp_redemption(v_next);
  IF (SELECT count(*) FROM public.living_stamp_marks WHERE book_id=v_book AND state='redeemed')<>6
  THEN RAISE EXCEPTION 'Second redemption must work on same book'; END IF;

  -- Reverse B->A can independently spend its available approved stamp.
  PERFORM set_config('request.jwt.claim.sub',v_a::text,false);
  v_receipt:=public.pointplus_request_living_stamp_redemption(
    v_book_b,1,'Reverse couple direction',gen_random_uuid());
  v_reverse:=(v_receipt->>'id')::uuid;
  IF (v_receipt->>'quantity')::integer<>1
  THEN RAISE EXCEPTION 'Reverse partner redemption failed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_b::text,false);
  PERFORM public.pointplus_fulfill_living_stamp_redemption(v_reverse);
  IF (SELECT count(*) FROM public.living_stamp_marks WHERE book_id=v_book_b AND state='redeemed')<>1
  THEN RAISE EXCEPTION 'Reverse couple fulfillment failed'; END IF;

  -- Outsider can never redeem, fulfill or cancel another room.
  PERFORM set_config('request.jwt.claim.sub',v_out::text,false);
  v_stale:=false;
  BEGIN PERFORM public.pointplus_request_living_stamp_redemption(
    v_book,1,'outsider',gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Outsider requested redemption'; END IF;
  v_stale:=false;
  BEGIN PERFORM public.pointplus_fulfill_living_stamp_redemption(v_next);
  EXCEPTION WHEN insufficient_privilege THEN v_stale:=true; END;
  IF NOT v_stale THEN RAISE EXCEPTION 'Outsider fulfilled redemption'; END IF;
END $m04$;

DO $permissions$
DECLARE fn text;
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.living_stamp_redemptions'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.living_stamp_redemption_marks'::regclass)
 THEN RAISE EXCEPTION 'Redemption ledgers must have RLS'; END IF;
 IF has_table_privilege('authenticated','public.living_stamp_redemptions','INSERT')
   OR has_table_privilege('authenticated','public.living_stamp_redemptions','UPDATE')
   OR has_table_privilege('authenticated','public.living_stamp_redemptions','DELETE')
   OR has_table_privilege('authenticated','public.living_stamp_redemption_marks','INSERT')
   OR has_table_privilege('authenticated','public.living_stamp_redemption_marks','UPDATE')
 THEN RAISE EXCEPTION 'Client can mutate redemption ledger directly'; END IF;
 FOREACH fn IN ARRAY ARRAY[
  'public.pointplus_request_living_stamp_redemption(uuid,integer,text,uuid)',
  'public.pointplus_fulfill_living_stamp_redemption(uuid)',
  'public.pointplus_cancel_living_stamp_redemption(uuid)',
  'public.pointplus_get_living_stamp_balance(uuid)'
 ] LOOP
  IF has_function_privilege('anon',fn,'EXECUTE')
    OR NOT has_function_privilege('authenticated',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'Unexpected RPC execution grants: %',fn; END IF;
 END LOOP;
END $permissions$;

SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
SET ROLE authenticated;
DO $outsider$
BEGIN
 IF (SELECT count(*) FROM public.living_stamp_redemptions)<>0 OR
    (SELECT count(*) FROM public.living_stamp_redemption_marks)<>0
 THEN RAISE EXCEPTION 'Outsider must not see redemption histories or associations'; END IF;
END $outsider$;
RESET ROLE;
SELECT 'M04 flexible redemption and atomic stamp spend integration tests: PASS' AS result;
