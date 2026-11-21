# Point+ Fast Stamp & Performance Refactor — M01

Branch: `feat/fast-stamp-performance-m01-m04` (single Draft PR for M01–M04).

## Scope completed in this milestone
- Room home and collection shelf expose a Quick Stamp action only when the book is active and the signed-in user occurs in `living_book_givers`.
- The shelf loads giver IDs in **one room-scoped query**, not one query per collection.
- Quick Stamp opens a compact accessible dialog; data is fetched on demand, without importing or initializing Living Editor, private photos, paper elements, reward history or full mark ledgers.
- A Stamp Card shows available slots based on pending/approved requests. Exact normalized slot coordinates reuse the current V3 card formula; the unique occupied-slot constraint remains authoritative for races.
- A free-placement Living Book uses its first page and a deterministic, best-effort grid position based on the submission key and nearby visible stamp positions. It does **not** guarantee collision-free placement under concurrency; owner placement tools remain the original path for rearrangement.
- Submission goes through the existing `giveLivingStamp` → `pointplus_give_living_stamp` authorized database RPC. No second balance, duplicate ledger, database schema migration or direct client DB write was added.
- The same logical command, including UUID idempotency key and position, is retained in memory and `sessionStorage` until the server reports success. A network-ambiguous retry cannot silently use a new key. UI shows a confirmed or pending message from the authoritative response; it does not claim pending is a confirmed mark.
- The Room and shelf paths are revalidated server-side on success; no browser-wide `router.refresh()` is needed for the acknowledgement.

## Security and concurrency invariants
- All server actions read authenticated room context. The **database RPC** still checks current membership, giver authorization, active status, page and artwork. UI eligibility is not trusted.
- `living_stamp_requests` retains `UNIQUE(book_id,giver_user_id,idempotency_key)`; replay with an identical payload returns the original request. A different payload with the same key is rejected by the RPC.
- For cards, `living_card_occupied_slot_unique` and `living_card_slot_guard` remain unchanged. The UI is advisory; a conflicting concurrent submission is rejected server-side and must refresh slot options.
- Direct issuance adds exactly one authorized mark; approval-required issuance remains pending until an independent reviewer acts.
- Existing redemption, archive, event history and paper-edit Save paths are untouched.
- This change has **no SQL migration and no Production data or schema modifications**.

## M01 test and release checks
- `node --test tests/fast-stamp-m01.test.mjs`: source contracts, lazy permissions, slot math, stable retry input, book placement, SQL/RPC security invariants.
- Existing CI verify: source regression, TypeScript, Next.js build, UX01–UX04, Living V3 M01–M05, and M23 card contracts.
- Isolated PostgreSQL M01–M05 + M23 RLS, concurrency and ledger fixture job enabled for this branch.
- Authenticated two-account hosted Staging E2E, iOS/Android touch inspection, and measured browser/server timing remain release blockers. Do **not** claim them passed solely based on CI.
- Current live Supabase schema was not directly inspected because the connected database read returned a permission error; verify the exact deployed M23 card schema on a staging project before any release.

## Explicit remaining risks
- Free-placement grid is **best-effort**, not an atomic cross-user reservation. No performance percentage or latency claim is made until M04 measurements.
- If `sessionStorage` is disabled and the tab crashes after submission, the user must manually inspect the ledger before starting another logical request; the open-tab retry remains idempotent.
- Shelf badge shows only this user's server-confirmed result until next server navigation; a global live counter and Reader/Editor separation belong to M02.
- A failed card slot caused by another user's concurrent request requires reopening the Quick Stamp dialog to retrieve the current free slots.

## Next milestone
M02 — Lightweight Book & Card. Do not start without explicit instruction. Keep Draft PR open, do not merge, deploy or alter Production.
