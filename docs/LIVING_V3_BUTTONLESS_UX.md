# Point+ — Living Stampbook V3 / Paper First & Buttonless UX

## Branch and release policy

- **Feature branch:** `feat/living-v3-buttonless-ux`
- **Single Draft PR:** [#31 — Paper First & Buttonless UX](https://github.com/kzabCde/PointPlus/pull/31)
- **Stacked base:** `feat/living-only-retirement` (PR #29, still Draft when work started). The Living V3 Server Action crash hotfix from PR #30 is included in the base; PR #30 is already merged into `main`.
- **Execution policy:** one UX milestone per explicit request, one PR for UX01–UX04, no merge, no Preview/Production deployment, no database migrations or Production data mutations.

## Milestone status

- [x] **UX01 — Paper First Layout** — implemented in this PR; the recorded CI outcome determines whether it can be considered verified
- [ ] UX02 — Contextual Editing & Direct Manipulation (**not started**)
- [ ] UX03 — Stamp & Page Gestures (**not started**)
- [ ] UX04 — Rewards, Animation, Accessibility & Hosted E2E (**not started**)

## UX01: implementation

### Primary reading surface

`app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx` now uses a centered, uncluttered Paper First workspace. The old cover/detail hero and three-column overview dashboard are removed **from the reading surface**; the description, recipient and book status remain accessible behind the top-right overflow disclosure.

`features/living-books/editor-studio.tsx` provides a compact book header with:

- A back link to the room's book shelf.
- The actual book title, without truncating the accessible title.
- One small `✿ <available>` badge that expands the **existing, fully functional** redemption/history panel.
- An overflow disclosure with book information and an optional sound toggle. Sound remains muted by default.

Critical rewards are not auto-run: the existing recipient quantity/reward form and owner confirm/cancel controls are preserved unchanged and available through the badge. UX04 will give the sheet its final interaction model; UX01 only removes the always-visible stack of forms.

### Navigation and editing

`features/living-books/page-manager.tsx` shows only previous/next and the page indicator. The indicator opens an accessible overview with all existing tools:

- Windowed page thumbnails (36 at a time), page number jump, reordering.
- Owner-only title/background editing with the existing debounced autosave.
- Owner-only manually added pages, including a discoverable add-page affordance at the last page.

Blocked navigation on unsaved writes and version conflicts remains in place.

`features/living-books/paper-editor.tsx` always mounts the paper canvas first. A single small `+` entry point opens a **contextual tool disclosure** with the existing pen, select, text, eraser, pan, stamp, photo upload, zoom and undo/redo controls. When an active pen/stamp/text mode is selected, a small contextual label makes that mode visible and provides an explicit Exit action. The selected-object inspector is only visible for a selected decoration.

Stamp preview/approval/peeling and pending requests remain reachable through a small conditional stamp panel; the same `LivingStampTools` component and server RPCs are reused. A recipient authorized to give stamps can place them without being the paper owner; edit permissions for text, drawing, images and owner-only stamp transforms remain separate.

Detailed editing instructions now live in a closed-on-load `<details>` disclosure. Live errors, unsaved warnings and retry controls are *not hidden*.

### Styling

`app/(protected)/s/[spaceId]/stamp-books/stamp-books.css` contains scoped `.living-reader*` rules that:

- Give the paper a wide, centered presentation.
- Keep contextual controls reachable with at least ~44px touch targets and focus outlines.
- Collapse page overview and tool/Stamp panels until opened.
- Use a compact reward sheet on desktop and a bottom-aligned responsive disclosure on mobile.
- Respect existing reduced-motion preferences and original Point+ coral/peach paper aesthetics.

This stage does **not** add new direct resize/rotation handles, edge-swiping page gestures, or a rebuilt redemption workflow. Those are explicitly UX02–UX04.

## Preservation and validation

- No SQL migrations or schema changes.
- No new spending calculations; **Supabase authoritative mark UUIDs, idempotency and atomic redemption remain intact**.
- M01–M05 server functions, room membership, private signed photo URLs, autosave, version conflicts, undos, peel/redeem irreversibility and archived/read-only states are preserved.
- New `tests/living-v3-ux01-paper-first.test.mjs` covers header, page navigation, drawer reachability, giver-vs-owner rights, editing/stamping/redemption presence and mobile/reduced-motion CSS.
- `.github/workflows/ci.yml` runs the new tests, existing M01–M05/regression suites, TypeScript, Next.js build, plus ephemeral PostgreSQL 16 migrations/RLS tests for this PR.
- **Browser screenshots and interactive touch E2E were not captured** without a running isolated application; they remain a QA gate. Source-level tests and a production build are not substitutes for real mobile interaction testing.

## Next explicitly authorized milestone: UX02

Add inline object editing, contextual toolbars, direct resize/rotation handles and touch alternatives, without touching stamp spending or the database.

**STOP after UX01. Keep PR #31 Draft.**
