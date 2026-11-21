# POINT+ Living Stampbook V3 — M02 Implementation / Migration Runbook

## Scope
**M02 — Page Manager & Paper Editor** is implemented on the *same* `feat/living-stampbook-v3` branch and Draft PR #28. It does NOT implement image uploads, real stamp issuance, peeling, redemptions, sound, autosave, history undo or a Production release (M03–M05).

## Features
- Per-book page list (stable UUID identities), page thumbnails, previous/next navigation, direct page selection, owner-only add-page control, page rename, background choice, and moving a page earlier/later.
- No automatic page creation after M01's initial page; page lifetime is not capped.
- Responsive editorial scrapbook canvas with zoom (60–180%) and pointer-based hand panning. Paper maintains 3:4 aspect ratio with normalized coordinates on all viewports.
- Select/move (mouse, pointer, stylus), keyboard arrows for fine positioning, enter/space focusable objects, pen with color/width and vector strokes, eraser for strokes, text placement and text formatting (color, size, family, alignment, bold/italic).
- Object property controls for size, rotation 360°, opacity, layer ordering, deletion and an explicit Save. The editor is read-only to nonowners.
- No full-page raster snapshots: strokes are stored as normalized vector points. Individual paths are bounded (1200 points / 64 KiB payload) for security and responsiveness, NOT a limit on page/stamp counts.
- Each write waits for a server-confirmed result before reporting success. The server checks ownership and version; stale-tab edits are rejected rather than silently overwritten.
- `page_id` is an immutable UUID; page index/order is separate and reordering never reassigns existing element identities.

## SQL
Migration `supabase/stamp-book-first/17_living_stampbook_v3_m02_editor.sql` must be applied **after** `16_living_stampbook_v3_m01.sql`.
- New `living_book_elements` table (soft-delete, normalized geometry, owner, version and compound book/page FK).
- `pointplus_private.living_editor_payload_valid`: validates supported text and drawing object payloads; disallows arbitrary HTML, untrusted URLs and image/stamp objects.
- `pointplus_update_living_book_page`: update title/background with owner membership and optimistic page version.
- `pointplus_save_living_book_element`: insert/update one decoration with validated dimensions, payload, foreign keys and expected version.
- `pointplus_delete_living_book_element`: soft delete with expected version.
- All RPC functions have explicit authenticated-only grants, restricted `search_path`, and owner checks; clients get SELECT-only table access behind RLS.

### Security
The browser cannot add spendable stamps using this table; accepted element types are `text` and `drawing` only. Stamp issuance and redemption are in later milestones with their own authoritative ledgers.
- Cross-book and cross-page references are rejected by SQL.
- Anonymous, nonmember, nonowner, archived-book and paused-book edits are rejected server-side.
- Direct Data API INSERT/UPDATE/DELETE grants are revoked.
- Concurrent object updates require exact `version`. A conflict returns SQLSTATE 40001 and the UI prompts for refresh.
- Page reorder is authorized by the M01 RPC; it locks the book and requires all page UUIDs, not just a subset.

## Verification / known limitations
- GitHub CI runs `tests/living-stampbook-m02.test.mjs` with permission/contract and pure geometry cases, all existing compatibility tests, TypeScript and Next.js build.
- **No isolated Supabase migration execution or real authenticated two-user browser E2E is claimed yet.** Supabase development branch creation requires extra hourly compute cost confirmation. Production migration remains NOT APPLIED.
- M05 will add autosave/undo/redo, image/page virtualization for very large books, touch-gesture polish, E2E and cross-device recovery. M02 currently relies on explicit saves for property edits; dragging/drawing submits on pointer release.
- The editor does not provide M03 images, stamp transformations, or flexible M04 rewards. Existing fixed-slot Stamp Card functionality is left untouched.

## Controlled release
1. Create/test an isolated database or obtain Supabase Branch cost approval.
2. Test M01 and M02 migrations in order. Verify table FKs, RLS, grants, function definitions, page ownership and version conflicts.
3. Test 100+ owner-added pages, cross-room reads, owner-only writes, consistent positions between desktop/tablet/mobile, pen/eraser gestures, two-tab conflicts, pending writes, and Stamp Card regressions.
4. Keep PR #28 as Draft. Do not merge or deploy Vercel preview or Production. Do not run SQL on Production until release approval after all milestones.
