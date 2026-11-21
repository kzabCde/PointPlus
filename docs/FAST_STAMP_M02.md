# Point+ Fast Stamp & Performance Refactor — M02 Lightweight Book & Card

Workstream: `feat/fast-stamp-performance-m01-m04`, **same Draft PR #37**. M01 preserved; M03/M04 not started.

## What changed
- The existing book URL `/s/[spaceId]/stamp-books/living/[bookId]` now defaults to a read-only Reader. Entering `?mode=edit` deliberately loads the original editable workspace.
- Ordinary reading no longer imports or mounts `LivingPaperEditor`, `LivingPageManager`, `LivingBookStudio`, and `LivingCardBoard` client modules. These are dynamically imported only in the explicit editor branch.
- The Reader renders **one requested page** using the original editor's normalized paper coordinates, typography, strokes, crop geometry and signed private photo URLs. The same stamp marks and pending requests determine real stamp / peeled / reserved / redeemed and pending states. No read-only record is ever added to the ledger.
- Fixed Stamp Cards use read-only numbered slots and show the existing fixed reward and pending stamps. Issuance and reviewer approval remain available in the original controlled workspace.
- A small reader metadata query resolves the requested page, previous/next UUIDs, and HEAD-only page counts. Decorations are retrieved solely for that page in stable bounded batches. No whole-book page list, full Editor state, other page decoration, Storage bucket enumeration, or full reward history is loaded.
- Reward history, previews and redemption operations are loaded only after a user opens the Reader's disclosure. Its client component is dynamically imported and remains governed by the existing authorized server action and RLS.
- The existing explicit Save for paper editing and immediate persistence for real stamps remain unchanged. The editor's page manager now retains `?mode=edit` when navigating pages, preserving unsaved-draft guards and existing context.
- M01 shelf Fast Stamp remains unchanged; creator/giver permissions are unchanged. No SQL migrations, new tables, changes to reward authorization, or Production writes.

## Security and integrity
- Reader page queries require `getSpaceContext`, book-scoped page selection and existing table RLS. Unknown/out-of-book page IDs fail closed.
- Decoration reads are scoped by `(book_id,page_id)` to the actual page. They use the existing RLS and foreign-key relationships.
- Photo signing uses the existing `loadLivingPageMedia` logic for **only the current page**. No public Storage bucket or arbitrary remote image links.
- Viewer supplies no database mutation interfaces. Original stamp, approval, owner paper edit, redemption and archive rules remain authoritative.
- The reader displays pending stamp requests without incrementing approved mark counts. Redeemed and peeled marks remain visible.

## Test and release gates
- `tests/fast-stamp-m02-reader.test.mjs`: read-only default, on-demand editor import, scoped page data, bounded navigation, original renderer structure, card-only SSR, lazy rewards and retained M01 contracts.
- Existing M01, Living V3 M01–M05, M23, UX01–UX04 and manual-save contracts remain in CI.
- Isolated PostgreSQL M01–M05 + M23 RLS/ledger fixtures remain enabled for the same feature branch.
- Authenticated two-account hosted Staging browser E2E, manual cross-browser mobile UX/photo rendering, real multi-tab Save behavior and measured timings are still release gates. Green CI alone does **not** prove a measured latency improvement.
- Direct Supabase live-read authorization was unavailable in the previous session; Production must not be used as a substitute for Staging.

## Limitations
- Large individual pages can still load many elements, photographs or stamps; only the *visible page* is loaded, with elements fetched in 200-row batches.
- Private photo URLs expire; the reader will request new signed URLs on navigation/refresh, not via the Editor's 14-minute background refresh. Long-idle opened pages may require a refresh.
- Existing read-only paper geometry is preserved; dimensions and animations should be visually checked on real devices.
- Reader reward claims use existing actions; after mutation a route refresh may be required to update the header summary, pending status and new read-only view.
- This milestone does not change creation flow (M03) and does not claim measured speedups (M04).

## Next milestone
M03 — Fast Creation. **STOP: do not start M03, merge, deploy, or change Production until explicitly instructed.**
