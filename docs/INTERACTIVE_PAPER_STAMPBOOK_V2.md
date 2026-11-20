# Point+ Interactive Stampbook V2 — M01–M04 integration

Branch: `feat/interactive-stampbook-v2` (based on `main`). **Never deploy or merge without approval.**

## Actual baseline and design

- The live PointPlus project is `gczribbtkfvhpzzupqre`; legacy v2-to-v3 proposals must not be replayed.
- The existing `StampBookJournal`, `BookMotionProvider`, approved stamp ledger, couple memory redemption, and archived book viewer are reused, not replaced with parallel systems.
- The original `pointplus_give_stamp` and `pointplus_create_stamp_book` RPC signatures remain callable.
- One tap/click creates one server-authorized, idempotency-keyed request. Browser placement never updates authoritative progress directly.
- Existing marks without coordinates are laid out deterministically in their historical order, six per notebook page.
- A new `single_sheet` mode displays one paper for the entire cycle; `notebook` uses ceil(target/6) pages. Both retain the existing reward logic.

## M01 — Paper UI

- `features/stamp-books/paper.tsx`: paper display, mouse/touch/stylus placement, keyboard placement, artwork tray, persisted and pending stamp visuals.
- `features/stamp-books/paper-model.ts`: normalized geometry and stable legacy positions.
- `features/stamp-books/journal.tsx`: paper replaces the fixed-slot surface while keeping page navigation, notes, progress, reward claims, and completion transitions.
- `app/(protected)/s/[spaceId]/stamp-books/paper.css`: paper texture, responsive layout, impact and pending effects.
- Book creation offers single sheet or notebook; couples may choose from all existing official stamp artwork.

## M02 — Server-authorized placement

**Production migration applied on 2026-11-20:** `20261120094702_pointplus_interactive_paper_stampbook_v2` (`12_interactive_paper_stampbook.sql`).

Additive columns:
- `stamp_books.layout_mode` (notebook by default)
- `stamp_book_stamp_requests.page_index/position_x/position_y/rotation_deg` (nullable)
- `stamp_book_marks.page_index/position_x/position_y/rotation_deg` (nullable)

New RPCs:
- `pointplus_create_paper_stamp_book`, wraps the original creator and saves layout transactionally.
- `pointplus_give_stamp_at`, checks page/coordinate bounds, calls the original guarded and idempotent giver, and persists approved mark placement in the same transaction.
- A `BEFORE INSERT` trigger copies pending request coordinates into marks when an existing manager later approves a stamp.

The existing RPCs and archive/claim tables remain untouched. Authenticated execute permission is granted only to the two new RPCs. RLS and original authorization continue to govern reads and issuance.

## M03 — Animation

Reuses the existing page-turn, book-opening, reward-reveal, stamp-impact and reduced-motion tokens. Paper stamps use the existing confirmation receipt, rather than animating an uncommitted mark as completed.

## M04 — Memory and reward integration

The existing Couple flow `pointplus_claim_couple_memory` retains the recipient's typed memory message and archives the book upon redemption. `pointplus_process_stamp_book_claim` still handles fulfillment. Archived books remain readable, while placing stamps is disabled both by the UI and the existing server-side book-state checks.

Existing non-Couple reward selection and cycles remain unchanged.

## Verification and release gate

This feature branch is **not production-ready** merely because source files have been committed.

Run the following on a fully fetched project:

```sh
npm ci
npm run typecheck
npm run build
node --test tests/stamp-book-journal.test.mjs tests/stamp-book-first-contract.test.mjs tests/interactive-paper-stampbook.test.mjs
```

Before release:
1. Verify current `main` and any concurrent feature work, and resolve conflicts explicitly.
2. Run the new SQL in an isolated PointPlus database clone first, after a verified backup; inspect constraints, trigger, function ACLs and RLS.
3. Test as two real signed-in accounts, both giver directions, approval_required, rejection, slow network, retries, concurrent final stamps, and claim/fulfillment/archive.
4. Verify legacy records with NULL coordinates, sheet and notebook layouts, mobile tap/swipe, screen readers, and reduced motion.
5. Record actual CI/build/E2E outcomes, restore-backup test, performance observations and the deployment prerequisites.
6. Confirm Preview deployment is disabled before opening or updating a PR if the repository/project automatically deploys PRs.
7. Apply audited SQL before deploying the new frontend; then deploy once after approval. Roll back application code safely if needed; keep additive columns and existing data rather than deleting marks.

**Release notes:** Base paper migration 12 is applied to PointPlus Production. The new scale/rotation migration 13 is separate; verify its migration status independently before release. Browser two-account E2E and actual performance measurements are still required. Creative stamp overlap is allowed; automated collision relocation has not been implemented. A keyboard user can place at the paper center, but future precise keyboard positioning would improve accessibility.

## M05 — Stamp sound, free rotation and resizing (2026-11-20)

- The paper no longer artificially clamps the stamp center to a 10% inset. All normalized x/y values from 0 to 1 are valid; intentional edge clipping remains part of the scrapbook feel.
- Scale is independently adjustable **40–250%** for each new stamp.
- Rotation is adjustable through the full **360°** circle (-180..180 equivalent), not just +/-15°.
- On touchscreens, a two-finger twist/pinch changes the *draft* stamp's rotation and size, without accidentally awarding a stamp or navigating the book. A separate tap stamps it; notebook page navigation remains available.
- On desktop, sliders, 15-degree buttons and reset provide precise control; keyboard arrows continue to move draft placement.
- Approved and pending stamp marks include their own scale/rotation. Historical marks without scale render at 100%. Archived books remain read-only.
- Sound effects: stamp thump, page turn, completion and reward reveal use local Web Audio synthesis. No microphone, TTS, third-party audio, tracking or streamed media.
- An accessible sound toggle and volume control persist per browser using `localStorage`. Browser interaction is required before starting audio; if Web Audio is unavailable, stamp operations continue silently.
- **SQL migration staged:** `supabase/stamp-book-first/13_free_transform_stamp_sound.sql`. It adds nullable `scale_factor` to approved marks and stamp requests, extends legal rotations and safely adds `pointplus_give_stamp_freely` while keeping `pointplus_give_stamp_at` backwards compatible.
- The existing historical and reward/claim ledgers are not replaced or reset.
- Verify latest GitHub CI as well as authenticated two-member browser tests before merging or deploying.

**Important:** Do not re-run migration 12, already applied in Production. Apply migration 13 exactly once, after verifying its dependency and committed SQL. SQL readiness is not permission to deploy the frontend automatically.
