-- Stamp Book First — READ ONLY deployment verification.
-- Existing schema must be applied only to verified project gczribbtkfvhpzzupqre.
SELECT n.nspname, c.relname, c.relrowsecurity,
       has_table_privilege('authenticated',c.oid,'INSERT') AS client_can_insert,
       has_table_privilege('authenticated',c.oid,'UPDATE') AS client_can_update,
       has_table_privilege('authenticated',c.oid,'DELETE') AS client_can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname LIKE 'stamp_book_%' AND c.relkind='r'
ORDER BY c.relname;

SELECT (SELECT count(*) FROM public.stamp_book_artworks) AS artwork_total,
       (SELECT count(*) FROM public.stamp_books) AS books,
       (SELECT count(*) FROM public.stamp_book_marks) AS stamps,
       (SELECT count(*) FROM public.stamp_book_claims) AS claimed_rewards;

-- All custom book stamp events should be from exactly one approved request.
SELECT count(*) AS invalid_awards FROM public.stamp_book_marks m
LEFT JOIN public.stamp_book_stamp_requests r ON r.id=m.request_id
WHERE r.id IS NULL OR r.status<>'approved'
 OR r.book_id<>m.book_id OR r.participant_id<>m.participant_id
 OR r.space_id<>m.space_id OR r.asset_id<>m.asset_id;

-- For all cycles, cached progress must match the authoritative count of marks.
SELECT count(*) AS mismatched_progress FROM public.stamp_book_cycles c
WHERE c.progress_count<>(SELECT count(*) FROM public.stamp_book_marks m WHERE m.cycle_id=c.id);

-- Completed cycles must be the only cycles with reward claims.
SELECT count(*) AS premature_claims FROM public.stamp_book_claims cl
JOIN public.stamp_book_cycles c ON c.id=cl.cycle_id
WHERE c.completed_at IS NULL OR c.progress_count<>c.target_snapshot
 OR c.book_id<>cl.book_id OR c.participant_id<>cl.participant_id
 OR c.space_id<>cl.space_id;

-- All reward options and book claims must stay in the same Room.
SELECT count(*) AS wrong_room_claims
FROM public.stamp_book_claims cl
JOIN public.stamp_book_reward_options r ON r.id=cl.reward_option_id
WHERE r.space_id<>cl.space_id OR r.book_id<>cl.book_id;

-- The legacy wallet should not gain/change records through new Stamp Book RPCs.
-- Compare the output to a pre-test snapshot and rollback-only E2E transaction.
SELECT count(*) AS old_ledger_count FROM public.point_transactions;
