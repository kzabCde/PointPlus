-- Execute AFTER M01 and M02 migrations against temporary PostgreSQL.
-- No external Supabase project, credentials, or user data.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

DO $checks$
DECLARE
  v_book uuid;
  v_page uuid;
  v_order uuid[];
  v_count integer;
  v_version bigint;
  v_element uuid := '11111111-1111-4111-8111-111111111111';
  v_receipt jsonb;
  v_rejected boolean;
BEGIN
  v_book := public.pointplus_create_living_book(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'Living Book Test','100+ pages are allowed','heart','direct',
    '99999999-9999-4999-8999-999999999999'
  );
  IF (SELECT count(*) FROM public.living_book_pages WHERE book_id=v_book)<>1
  THEN RAISE EXCEPTION 'Creating a book must create exactly one first page'; END IF;
  IF public.pointplus_create_living_book(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'Living Book Test','100+ pages are allowed','heart','direct',
    '99999999-9999-4999-8999-999999999999'
  )<>v_book
  THEN RAISE EXCEPTION 'Idempotent create must return same book'; END IF;

  FOR v_count IN 1..120 LOOP
    PERFORM public.pointplus_add_living_book_page(
      v_book,gen_random_uuid(),'หน้า '||v_count,'cream');
  END LOOP;
  IF (SELECT count(*) FROM public.living_book_pages WHERE book_id=v_book)<>121
  THEN RAISE EXCEPTION 'A Living Book must allow 100+ manual pages'; END IF;
  IF (SELECT count(*) FROM public.living_book_pages WHERE book_id=v_book AND page_order<>1)<>120
  THEN RAISE EXCEPTION 'Page order corrupted'; END IF;

  SELECT array_agg(id ORDER BY page_order DESC) INTO v_order
    FROM public.living_book_pages WHERE book_id=v_book;
  IF public.pointplus_reorder_living_book_pages(v_book,v_order)<>121
  THEN RAISE EXCEPTION 'Reorder must return all 121 pages'; END IF;
  v_page:=v_order[1];
  IF (SELECT page_order FROM public.living_book_pages WHERE id=v_page)<>1
  THEN RAISE EXCEPTION 'Page reorder did not preserve page UUID'; END IF;

  SELECT version INTO v_version FROM public.living_book_pages WHERE id=v_page;
  v_receipt:=public.pointplus_update_living_book_page(
    v_book,v_page,'Our Special Page','grid',v_version);
  IF (v_receipt->>'version')::bigint<>v_version+1
  THEN RAISE EXCEPTION 'Page version must advance'; END IF;

  v_receipt:=public.pointplus_save_living_book_element(
    v_book,v_page,v_element,'text',
    '{"text":"hello","fontSize":24,"color":"#aa4455","fontFamily":"sans","align":"left","bold":false,"italic":false}'::jsonb,
    0.3,0.4,0.25,0.15,0,1,0,0
  );
  IF (v_receipt->>'version')::bigint<>1
  THEN RAISE EXCEPTION 'New element must have version 1'; END IF;
  v_receipt:=public.pointplus_save_living_book_element(
    v_book,v_page,v_element,'text',
    '{"text":"edited","fontSize":24,"color":"#aa4455","fontFamily":"sans","align":"left","bold":true,"italic":false}'::jsonb,
    0.32,0.44,0.25,0.15,30,1,1,1
  );
  IF (v_receipt->>'version')::bigint<>2
  THEN RAISE EXCEPTION 'Edited element must advance to version 2'; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.pointplus_save_living_book_element(
      v_book,v_page,v_element,'text',
      '{"text":"stale","fontSize":24,"color":"#aa4455","fontFamily":"sans","align":"left","bold":false,"italic":false}'::jsonb,
      .3,.3,.2,.15,0,1,0,1);
  EXCEPTION WHEN serialization_failure THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Stale version should be rejected'; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.pointplus_save_living_book_element(
      v_book,v_page,gen_random_uuid(),'text',
      '{"text":"unsafe","fontSize":24,"color":"javascript:evil","fontFamily":"sans","align":"left","bold":false,"italic":false}'::jsonb,
      .3,.3,.2,.15,0,1,0,0);
  EXCEPTION WHEN invalid_parameter_value THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Unsafe text color must be rejected'; END IF;

  PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
  v_rejected:=false;
  BEGIN
    PERFORM public.pointplus_add_living_book_page(v_book,gen_random_uuid(),null,'cream');
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Recipient must not add pages'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.pointplus_delete_living_book_element(v_book,v_page,v_element,2);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Recipient must not delete decorations'; END IF;
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

  v_receipt:=public.pointplus_delete_living_book_element(v_book,v_page,v_element,2);
  IF v_receipt->>'deleted'<>'true'
    OR (SELECT deleted_at IS NULL FROM public.living_book_elements WHERE id=v_element)
  THEN RAISE EXCEPTION 'Decoration soft-deletion failed'; END IF;

  IF (SELECT count(*) FROM public.living_books WHERE id=v_book AND status='active')<>1
  THEN RAISE EXCEPTION 'Living Book must stay active after edits'; END IF;
END $checks$;

DO $permissions$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.living_book_elements'::regclass)
  THEN RAISE EXCEPTION 'Living elements must have RLS enabled'; END IF;
  IF has_table_privilege('authenticated','public.living_book_elements','INSERT')
     OR has_table_privilege('authenticated','public.living_book_elements','UPDATE')
     OR has_table_privilege('authenticated','public.living_book_elements','DELETE')
  THEN RAISE EXCEPTION 'Authenticated must not write decorations directly'; END IF;
  IF has_function_privilege(
       'anon','public.pointplus_save_living_book_element(uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,integer,bigint)',
       'EXECUTE')
  THEN RAISE EXCEPTION 'Anon must not execute editor RPC'; END IF;
  IF NOT has_function_privilege(
       'authenticated','public.pointplus_save_living_book_element(uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,integer,bigint)',
       'EXECUTE')
  THEN RAISE EXCEPTION 'Authenticated owner needs RPC grant'; END IF;
END $permissions$;

SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
SET ROLE authenticated;
DO $rls$
BEGIN
  IF (SELECT count(*) FROM public.living_books)<>0
    OR (SELECT count(*) FROM public.living_book_pages)<>0
    OR (SELECT count(*) FROM public.living_book_elements)<>0
  THEN RAISE EXCEPTION 'Outsider must not see Living Books'; END IF;
END $rls$;
RESET ROLE;
SELECT 'Living M01 + M02 ephemeral PostgreSQL migrations and permission tests passed' AS result;
