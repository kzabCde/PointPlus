# POINT+ Living Stampbook V3 — M01 Compatibility and Release Notes

**Source of truth:** `main` in `kzabCde/PointPlus`; Supabase Project `gczribbtkfvhpzzupqre` was audited read-only. **Production V3 migration NOT APPLIED.**

## Compatibility analysis

- Existing `stamp_books` and `stamp_book_cycles` require a `target_count` and finite `target_snapshot`. Do **not** lift the limit to an arbitrary high number.
- Existing `pointplus_claim_couple_memory` archives a book on claim. Living Books deliberately **do not** call the old claim function.
- `stamp_card` uses its existing `pointplus_give_stamp_to_card` RPC and slot-indexed mark ledger; its path is left intact.
- The current viewer uses paper-page geometry derived from stamp count. Living Book pages must be independent UUID entities and are added solely through the owner action.
- Room membership is scoped by `space_members(space_id,user_id)`. Adults are represented as `participants(kind='adult',user_id)`; only the other couple member may receive a Couple Living Book.
- Production migration log already includes 20261120114849 (`pointplus_click_card_slot_to_stamp_v2_3`); do not reapply historical migrations.
- Production data has changed since the earlier test cleanup. **Never assume rooms or accounts are empty.**

## M01 implementation

Migration: `supabase/stamp-book-first/16_living_stampbook_v3_m01.sql`.

New additive tables:
- `living_books`: active continuous room-bound books; one active/paused book per creator/recipient direction; creator and recipient must belong to the room; no stamp target, completion threshold, or automatic archive.
- `living_book_pages`: stable page UUIDs, ordered bigint ranks, background, title, creator, optimistic `version`, owner-generated idempotency key. Exactly one page created by the creator RPC; later pages are only explicit owner actions. No fixed page cap.
- `living_book_givers`: separate per-book giver identity, currently initialized with creator. M03 will introduce the authorized issuance ledger and policy checks; do not treat decorative elements as spendable stamps.

New RPCs:
- `pointplus_create_living_book` — validates room, actor, recipient, and artwork, creates a Living Book + single first page atomically; creation key safe for retries.
- `pointplus_add_living_book_page` — only active book owner can add; serializes by book row lock and reuses idempotency key on retry.
- `pointplus_reorder_living_book_pages` — owner-only, validates every page UUID exactly once, serializes with page additions, uses deferred unique order constraint.
- `pointplus_get_living_book_summary` — invoker function returns first page and page count to authorized room member.

All three tables enforce RLS for reads and revoke direct table writes from `authenticated` and `anon`. Mutations are authenticated RPCs with explicit membership checks, safe `search_path` and minimal execute grants.

UI:
- New creation screen chooses Living Stampbook or legacy Stamp Card.
- Legacy Stamp Card form stays on its old RPC and retains the card-only UI when chosen.
- Living Book forms never send finite target or mandatory rewards.
- Living Books appear alongside legacy collections in the room shelf.
- Detail page shows current page count and a single page preview. Owner may add pages; other members are read-only.
- M02 editor tools and M03 issuance are deliberately **not** implemented in M01.

## Migration runbook / release gates

1. Verify live schema and migration history immediately before release. Do not assume the test-data cleanup is still current.
2. Create an isolated Supabase development branch **only after explicit user approval of additional hourly compute charges**, or use a locally provisioned test Postgres with baseline migrations.
3. Apply only the new M01 migration in that isolated environment; inspect RLS, indices, constraints and RPC grants.
4. Test both user directions, guest and outsider rejection, owner page permissions, duplicate key retry, 100+ page additions, cross-room access, concurrent creation/add/reorder, Stamp Card regression.
5. Confirm rollback plan and production backup. Do not apply the staged migration to Production until M01–M05 all pass and explicit release approval is given.
6. No Vercel Preview/Production deployment; keep PR Draft. Do not merge or begin M02 without user instruction.

## Verification notes

GitHub contract CI is run per PR head. It is not a substitute for a real Supabase migration or two-account authenticated E2E.

Supabase development-branch creation was attempted without a cost ID and the provider required cost confirmation. No branch was created, no test database migration run and no Production mutation occurred.
