#!/usr/bin/env bash
set -euo pipefail
# Real two-connection PostgreSQL race, following completed M04 SQL assertions.
# A->B book has 7 available marks. Both requests try to reserve 5.
book="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT id FROM public.living_books WHERE owner_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' LIMIT 1")"
if [[ -z "$book" ]]; then echo "Missing A->B book"; exit 1; fi
one="$(mktemp)"
two="$(mktemp)"
trap 'rm -f "$one" "$two"' EXIT
(
psql -v ON_ERROR_STOP=1 >"$one" 2>&1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT public.pointplus_request_living_stamp_redemption(
 '$book',5,'Race one 5 stamps','77777777-7777-4777-8777-777777777770'
);
\echo FIRST_BOOK_RESERVATION_ACQUIRED
SELECT pg_sleep(3);
COMMIT;
SQL
) &
first_pid=$!
ready=0
for i in {1..60}; do
 if grep -q FIRST_BOOK_RESERVATION_ACQUIRED "$one"; then ready=1; break; fi
 if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
 sleep .1
done
if [[ "$ready" -ne 1 ]]; then
 cat "$one"; echo "First reservation never started"; wait "$first_pid" || :; exit 1
fi
if psql -v ON_ERROR_STOP=1 >"$two" 2>&1 <<SQL
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT public.pointplus_request_living_stamp_redemption(
 '$book',5,'Race two 5 stamps','77777777-7777-4777-8777-777777777771'
);
SQL
then
 cat "$one" "$two"; echo "Double-spend: second reservation unexpectedly succeeded"; exit 1
fi
wait "$first_pid"
if ! grep -q 'Not enough available stamps' "$two"; then
 cat "$two";echo "Second failure was not insufficient balance";exit 1
fi
state="$(psql -At -v ON_ERROR_STOP=1 -c "SELECT
 (SELECT count(*) FROM public.living_stamp_marks
 WHERE book_id='$book' AND state='reserved'),
 (SELECT count(*) FROM public.living_stamp_marks
 WHERE book_id='$book' AND state='available'),
 (SELECT count(*) FROM public.living_stamp_redemptions
 WHERE book_id='$book' AND reward_message LIKE 'Race %')
" | tr -d '[:space:]')"
if [[ "$state" != '5|2|1' ]]; then
 echo "Unexpected result: $state; expected 5 reserved, 2 available, one race request"
 exit 1
fi
echo "PASS: two simultaneous 5-stamp claims against 7 available did NOT double-spend"
