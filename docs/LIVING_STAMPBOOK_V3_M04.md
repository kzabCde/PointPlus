# POINT+ Living Stampbook V3 — M04 Flexible Redemption

**Branch** `feat/living-stampbook-v3`  
**Single Draft PR** https://github.com/kzabCde/PointPlus/pull/28  
**Milestone** M04 ONLY; M05 is not started  
**Production** SQL migration NOT APPLIED; no merge, Vercel Preview or Production deployment.

## User-to-user redemption contract

In a Couple room, when A creates a Living Stampbook for B and gives the stamps:

- **B** alone selects how many available stamps to redeem and writes a free-text reward message. Quantity can be any positive integer no greater than the current available balance; no fixed target is required.
- **A** alone fulfills the pending redemption or cancels it. Fulfillment changes precisely the reserved stamps to `redeemed`, records a permanent used-ink blemish on the page and preserves their original identity and redemption link.
- Cancellation releases precisely those stamps back to `available`. The canceled request, the exact stamp associations and both reserve/release audit events remain in history.
- The Living Book never automatically completes, archives or restarts its collection cycle. A can stamp the same book again after a fulfilled reward.
- The reverse direction **B→A** works identically, with A the receiving person.
- For child recipients in Family/Group rooms, the linked guardian may request redemption on the child's behalf only when the child has no linked `user_id`; there is no generic room-member privilege to spend another person's stamps.

### Transaction and state invariants

Schema migration `supabase/stamp-book-first/19_living_stampbook_v3_m04_redemptions.sql` (apply AFTER `16`, `17`, `18`):

1. **`living_stamp_redemptions`** holds the immutable requested quantity/message, status `requested` / `fulfilled` / `canceled`, requester, owner confirmation/cancellation audit and per-requester idempotency key.
2. **`living_stamp_redemption_marks`** stores the exact permanent UUID of every stamp selected for each request; associations are never deleted on cancellation.
3. **`living_stamp_marks`** expands the M03 stamp states to `available` / `reserved` / `redeemed` / `peeled`. A mark has `redemption_id`, `reserved_at`, `redeemed_at`, a composite FK to the correct book, and a state-specific lifecycle constraint. Redeemed and peeled marks cannot be reused.
4. **`living_stamp_events`** extends its append-only event types to `reserved`, `redeemed`, `released` in addition to the original M03 events.
5. All new public tables have RLS; direct client write grants are revoked. Only authenticated, book-authorized, narrowly granted RPCs may change stamp/reward state.

### Atomic RPCs

- `pointplus_request_living_stamp_redemption(book,quantity,reward,key)`: verifies recipient/guardian identity, locks the single Living Book row also locked by M03 give/peel/transform RPCs, locks exactly the earliest eligible stamp rows, rejects insufficient balance, creates the request and exact associations, sets their state to reserved and emits immutable reserve events in **one database transaction**. Reusing a key returns the same request/marks, even after fulfillment/cancellation, without minting another reservation.
- `pointplus_fulfill_living_stamp_redemption(redemption)`: validates the actual book owner, locks the book and reserved stamps, validates the complete quantity/association count, marks only those reserved stamps redeemed and records used-ink events. Repeated successful calls do not duplicate events.
- `pointplus_cancel_living_stamp_redemption(redemption)`: only the actual owner may cancel; releases exactly the request's reserved stamps, keeps the linked history, appends release events. Cannot cancel a fulfilled request or unspend redeemed stamps.
- `pointplus_get_living_stamp_balance(book)`: invoker/room-authorized read returns authoritative `total`, `available`, `reserved`, `redeemed`, `peeled` counts across every book page.

### UI / page behavior

- Receiving partner gets an input for stamp quantity and a free-text reward description; a preview shows available stamp artwork in the server selection order. **Preview is advisory**: exact stamp UUIDs are committed by PostgreSQL and appear in the request receipt/history.
- Room-wide stamp counts appear above the form. The last 40 historical requests and their exact stamp associations are displayed, together with requester text, date and status.
- Only the owner is shown Fulfill/Cancel actions for pending requests. Nonrecipient room members cannot request redemption.
- Current-page stamp artwork remains visible. `reserved` stamps show `จองไว้`; `redeemed` stamps show a faded/distressed `แลกแล้ว` overlay; peeled stamps retain the M03 `ลอกแล้ว` ghost. Neither reserved nor redeemed stamps can be moved or peeled.
- Existing Stamp Card behavior, Living Book pages, notes, images, stamps, Couple membership and all previously deployed database records remain unchanged.

## M04 verification plan and results

CI runs:
- `tests/living-stampbook-m04.test.mjs` — typed input/output action contracts, request validation, unmodifiable used state, front-end access gating and schema constraints.
- `tests/sql/living-v3-m04-assertions.sql` — PostgreSQL 16 integration after M01→M02→M03→M04 migrations. Covers 5-of-12 spending, more than one redemption on the same book, extra stamps after fulfillment, canceling 7 of 8 available, exact refund/history preservation, idempotent retries, replay after fulfillment, unauthorized requester/fulfiller, guardian restrictions, invalid inputs, reverse Couple direction, mark-peeling/transform rejection, outsider RLS and minimum grants.
- `tests/sql/living-v3-m04-concurrency.sh` — **two simultaneous PostgreSQL sessions** both request 5 stamps while only 7 are available; book row locking must cause one reservation to succeed and the second to be rejected, leaving 5 reserved, 2 available and one race request.
- Existing M01/M02/M03 tests, Stamp Card contracts, TypeScript typecheck and Next.js build.

**Limitations:** The ephemeral PostgreSQL tests use a minimal Room/Auth/Storage fixture, not an actual hosted Supabase branch. Real authenticated two-account browser E2E, mobile network interruptions, live Storage and true production migrations remain release gates and are not claimed complete.

## Release constraints

- Keep PR #28 **Draft**, do not merge or publish a Vercel Preview.
- Do **not** execute M01–M04 migration SQL against Production yet.
- Do not begin M05 until the user asks for it.
- For final release, apply migrations in the verified order to a hosted staging database, run full two-user auth and RLS E2E, obtain Production migration authorization and ensure a backup and rollback procedure.
