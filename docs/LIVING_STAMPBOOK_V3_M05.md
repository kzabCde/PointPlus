# POINT+ Living Stampbook V3 — M05 UX, Animation & Reliability

**Worktree:** `feat/living-stampbook-v3`  
**Pull request:** [#28](https://github.com/kzabCde/PointPlus/pull/28) — remains **DRAFT**, never merged or deployed in M05.  
**Scope:** M05 only, preserving every M01–M04 relational and functional contract.

## Delivered behavior

### Paper / stamp foley

- Sound is **muted by default**. A visible, accessible toggle in the Living Book Studio lets the user opt in and persists the preference in browser localStorage when allowed.
- Web Audio synthesizes original short `page`, `write`, `stamp`, `peel`, `reward`, `undo` and `error` cues. **No external samples, copyrighted background music, or downloads**.
- Cues are dispatched only after successful, server-confirmed actions (stamp issue, peeling, redemption confirmation, page saves, editor saves) or a deliberate page turn; audio is suspended/ignored for hidden pages or unsupported browser audio.
- If audio is blocked or localStorage is unavailable, the app remains fully functional and silent.

### Realistic motion / accessibility

- Subtle CSS paper-opening and page-reveal, stamp impact on **newly received** marks only, peel traces and post-redemption used-stamp ink. All transforms are layout safe.
- `@media(prefers-reduced-motion:reduce)` disables decorative motion. Touch targets are at least 44 px where possible, with keyboard focus and text feedback.
- Page controls support touch swipe left/right without interfering with pen strokes; paper supports two-finger pinch zoom (60–220%), pan with hand tool, pointer/mouse/stylus.
- Retains responsive normalized object positions and the entire M02 pen/text/image toolset.

### Autosave and Undo/Redo

- Page title/background autosave after 850 ms of inactivity. The latest page version is sent to `pointplus_update_living_book_page`; multi-tab write conflicts are surfaced and do not overwrite newer remote state.
- Paper text/image/vector properties autosave after 850 ms. Drafts remain in client memory if a network/server write fails, with an explicit retry control and user-visible warning.
- Direct pen strokes/new text and moving decorations use confirmed server writes. Failed creates/strokes are retained as unsaved paper elements instead of disappearing.
- A bounded 60-action, **in-memory/per-page** Undo/Redo stack tracks **only confirmed decorative object operations**: create, update, delete, and restore. It does not undo real stamps, peeling, redemption, or issued rewards. Keyboard shortcuts Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y work when focus is on the editor rather than in native text inputs.
- New SQL `20_living_stampbook_v3_m05_reversible_editor.sql` introduces an authenticated, **owner-only, version-checked** `pointplus_restore_living_book_element` RPC for safely reactivating soft-deleted text/drawing/image records by their original UUID. It checks private Storage object presence before restoring an image. Existing M01–M04 migrations remain unchanged.
- M05 editor soft-deletes photo decorations without immediately removing their private Storage files, so Undo can restore a real image rather than an empty placeholder. A later retention/garbage-collection policy is needed for physical deletion of orphaned pictures.
- Page navigation is blocked while dirty or saving, the browser warns on reload/close, and the UI exposes a retry action. **Limitations:** Browser process termination during in-flight requests cannot guarantee saving; Undo history is not shared across devices nor persisted across reload; this does not claim offline editing. Navigating with browser back gestures is not yet interceptable with the same guarantee as page UI navigation.

### Large books and private photos

- Page thumbnails are windowed at 36 at a time, with numbered page jump, previous/next, and previous/next thumbnail ranges. The app does not mount the entire lifetime thumbnail collection.
- Page content and stamp marks are fetched **only for the active page** in bounded Supabase range queries. Private image rows are paginated and Signed URL generation is bounded to batches of 8 to reduce spikes/429s.
- Private signed image URLs are refreshed before their 20-minute lifetime expires, only while the book is visible and no unsaved edits are pending.
- Redemption history fetches at most 9 artwork thumbnails per request (full stamp IDs remain in SQL audit ledger and request quantity remains authoritative), rather than fetching every stamp image when one reward used hundreds of stamps.
- **Limitations:** Page metadata list still loads all UUID/title rows for ordering and owner page management; this is not a database-cursor paginated infinite-scroll backend. Hundreds to thousands of pages are better handled, but truly massive page counts still need benchmarking.

## Tests and gates

### GitHub CI (no production mutations)
- `tests/living-stampbook-m05.test.mjs`: Undo/Redo reducer behavior and 60-action bound, version-independent payload equality, denied and stale restore RPCs, autosave failure retention, sound defaults, mobile controls and loading/virtualization contracts.
- Ephemeral PostgreSQL 16 runs M01 → M02 → M03 → M04 → M05 migrations in order; `tests/sql/living-v3-m05-assertions.sql` verifies owner-only restoration, recipient/outsider denial, stale expected versions, cross-page rejection, image Storage file retention, original payload integrity and unchanged stamp/reward ledgers.
- Existing M01–M04 integration tests and concurrent double-spend test remain in CI, along with TypeScript strict typecheck, production build, and original Stamp Card regression suite.

### Hosted staging E2E (provided but intentionally not executed against Production)
- `tests/e2e/living-v3-hosted.test.mjs`, invoked with `npm run test:e2e:living` **only on a separately authorized isolated Supabase staging project** with two test accounts and two precreated reverse-direction Living Books.
- The script refuses to run against the known Production project and refuses to run when staging confirmation/credentials are missing. It exercises real Supabase Auth, Data API/RLS, two-user permission denial, version conflicts, editable text undo/restore, private image upload and member signed URLs, real stamp issue/approval, partial redemption, continued active book, and reverse Couple direction.
- CI runs `node --check` for the optional script. Full hosted tests are **NOT yet verified**, because no independent paid Supabase branch is approved and no M01–M05 migrations are applied there. Real browser gesture/touch testing across iOS/Android is still required before Production release.

To run hosted E2E later, provision a **non-Production Supabase project** and install migrations 16–20 there, create two test users in a Couple Room with one active A→B book and one active B→A book, then set:

```text
POINTPLUS_E2E_STAGING_ONLY=1
POINTPLUS_E2E_SUPABASE_URL=https://<staging-project>.supabase.co
POINTPLUS_E2E_PUBLISHABLE_KEY=<staging-publishable-key>
POINTPLUS_E2E_A_EMAIL=<a@example.test>
POINTPLUS_E2E_A_PASSWORD=<secret>
POINTPLUS_E2E_B_EMAIL=<b@example.test>
POINTPLUS_E2E_B_PASSWORD=<secret>
POINTPLUS_E2E_ROOM_ID=<couple-room-uuid>
POINTPLUS_E2E_BOOK_A=<book-owned-by-A-for-B-uuid>
POINTPLUS_E2E_BOOK_B=<book-owned-by-B-for-A-uuid>
```

Then `npm run test:e2e:living` locally or in an isolated, protected staging CI job. Never put passwords into Git, logs, or NEXT_PUBLIC environment variables.

### Release restrictions

**STOP AFTER M05:** keep Draft PR #28 unmerged. Do not create Vercel Preview or production deployment, and do not apply migrations 16–20 to Production. Only after release approval, perform a backup and staged migration rehearsal, then conduct two-user browser and RLS tests before the Production cutover. Existing Stamp Cards and legacy room history must be preserved.
