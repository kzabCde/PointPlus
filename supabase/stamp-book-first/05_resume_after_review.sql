-- Point+ Stamp Book First — RE-ENABLE AFTER CORRECTIVE TESTS.
-- Operator only, after checking project ref and current privilege state.
-- Preserves all book records, marks, cycles, claims and historical data.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.stamp_books') IS NULL OR
 to_regclass('public.stamp_book_claims') IS NULL THEN
 RAISE EXCEPTION 'Stamp Book schema not found'; END IF;
END $guard$;
GRANT EXECUTE ON FUNCTION public.pointplus_create_stamp_book(
 uuid,text,text,integer,boolean,boolean,text,uuid[],uuid[],text[],text[]
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_give_stamp(uuid,uuid,text,text,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_review_stamp_request(uuid,boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_claim_stamp_book_reward(uuid,uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_process_stamp_book_claim(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_update_stamp_book(uuid,text,text,text,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pointplus_add_stamp_book_reward(uuid,text,text,integer) TO authenticated;
COMMIT;
-- No points, Rooms, rewards, awards or ledger rows removed.
