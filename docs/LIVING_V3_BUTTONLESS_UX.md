# Point+ — Living Stampbook V3 / Paper First & Buttonless UX

## Branch and release policy

- **Feature branch:** `feat/living-v3-buttonless-ux`
- **Original single PR:** [#31 — Paper First & Buttonless UX](https://github.com/kzabCde/PointPlus/pull/31). **EXTERNAL CHANGE:** PR #31 was merged into `feat/living-only-retirement` at 2026-11-21 07:12:30 UTC while UX04 was in progress (merge commit `62b3c0ff85082b8af62f57789d6e14247871490c`). It is no longer possible to keep this same PR Draft. UX04 commits remain on the same feature branch **after** that merge; they were not part of merged PR #31. No new PR was created.
- **Stacked base:** `feat/living-only-retirement` (PR #29, still Draft when work started). PR #29 was subsequently closed without merging according to the GitHub API. PR #30 Server Action hotfix was already merged into `main`. This external PR dependency change is a **release blocker** until the branch integration strategy is reviewed.
- **Execution policy:** one UX milestone per explicit request, one PR for UX01–UX04, no merge, no Preview/Production deployment, no database migrations or Production data mutations.

## Milestone status

- [x] **UX01 — Paper First Layout** — implemented in this PR; the recorded CI outcome determines whether it can be considered verified
- [x] **UX02 — Contextual Editing & Direct Manipulation** — implemented and covered by regression/geometry tests (CI status on final head)
- [x] **UX03 — Stamp & Page Gestures** — implemented; final CI and release gates below
- [x] **UX04 — Rewards, Animation, Accessibility & E2E** — UI implemented with real React SSR integration tests and a staging-only two-account Playwright browser E2E gate; actual hosted browser run remains blocked without isolated staging deployment/credentials.

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

## UX02: contextual selection & direct manipulation

Implementation remains in the same stacked feature branch and Draft PR. **No new SQL migration or Production data manipulation.**

### Selection, resize, rotation and touch

- Selecting text, drawing or a private photo on paper produces an unobtrusive selection frame, four corner handles and a rotation handle. Dragging any selected object moves it without an inspector.
- Rotated corners are resized in the object's own coordinate axes using `features/living-books/direct-manipulation.ts`, anchoring the opposite corner. Images preserve aspect ratio; text and vector drawings may stretch. Normalized coordinates are kept within the page.
- A two-finger gesture starting **on the same decoration** scales that object around its center. A two-finger gesture started on other parts of the canvas continues to zoom the page, preserving M05. Cancellation reverts the temporary preview.
- The editor commits one authenticated version-checked write after a completed move/resize/rotate/pinch gesture. Intermediates are local previews only; no stamp-mint or reward mutation, no per-move RPC flooding.
- Selected decorations still support keyboard selection and arrows for movement. Shift+arrow rotates by five degrees, Alt+arrow adjusts width/height; precise range controls remain accessible through the More panel.
- The mobile drag targets have 44px hit areas; reduced-motion and visible keyboard focus rules still apply.

### Text, images, ink and contextual controls

- Double-click/double-tap an existing text object, or choose **Edit text** from the selected-object toolbar, to edit it inline in the exact paper position. New text opens inline editing after the first authorized save. Multiline text, 5000-character limit and existing font/style validation persist.
- Floating object-specific toolbar appears **only for the selected object**. Quick actions include text font size/weight/italic/color, drawing ink color, photo crop entry and layer ordering.
- Detailed crop, positioning, font/align, dimensions, opacity, rotation and accessible fallback controls remain fully functional but **closed until More**; changes continue through the existing debounced autosave.
- Pen/eraser tools show a small ink strip (color, stroke thickness, eraser, Done), avoiding full-time editing menus. Selecting Done exits drawing mode.
- The original Add > Photo input remains, while authenticated owners can also drag a JPEG/PNG/WebP file over the paper. The same `preparePhotoForUpload` and `uploadLivingPhoto` path handles conversion, file size, private Storage and permissions; a denied/unsupported/drop-during-save cannot navigate the browser away from the current page.
- Autosave queues later text edits if they arrive while an earlier write is still in flight. Failed writes retain the draft and visible retry instead of silently clearing it.

### Engineering and verification

- `features/living-books/direct-manipulation.ts`: pure, data-independent normalized transform geometry, with predictable image aspect ratio behavior.
- `tests/living-v3-ux02-contextual.test.mjs`: execute actual transform helpers through TypeScript transpilation; assert movement bounds, rotated resizing, rotation normalization, pinch scale, and source contracts for inline editing, keyboard alternatives, photo upload, contextual inspector, pointer-cancel and autosave.
- `tests/living-stampbook-m02.test.mjs`: update the Pointer Cancel contract to check that touch identity is released and temporary movement is rolled back.
- `.github/workflows/ci.yml`: runs the new UX02 suite *in addition to* UX01, existing M01–M05 suites, TypeScript, production build, and ephemeral PostgreSQL integration.

**Unverified before Release:** Full interaction E2E in a browser with real iOS/Android pointer/touch hardware, real signed URL photo uploading, and assistive-technology walkthrough. CI geometry and source tests do not substitute for device/browser E2E. UX03 and UX04 remain untouched.

## UX03: tactile stamping, peeling and page gestures

Implemented on the original `feat/living-v3-buttonless-ux` branch in Draft PR #31. **No schema migration, no Production data mutation and no deployment.**

### Real-stamp visual workflow

- The single Add > Stamp entry exposes a visual, accessible stamp tray using the **existing official artwork**. Art choices are buttons with pressed-state accessibility; selecting art closes the tray to free the paper.
- Tap an empty spot on paper to create an **unissued preview only**, never a `LivingStampMark`. The preview has an obvious `ตัวอย่าง` watermark; drag it to position and use compact on-paper actions to rotate or scale. Precise sliders are retained behind a collapsed control.
- Reopen confirmation from the small floating preview action even after dismissing the mobile tray; draft is not lost. The tray has an explicit close button.
- The user must submit the actual stamp request explicitly. The client calls the same `giveLivingStamp` server action and `pointplus_give_living_stamp` PostgreSQL RPC with exact art UUID/identity, position, angle, scale and a giver-scoped idempotency key.
- A synchronous in-flight lock blocks double submissions. If a response is ambiguous due to network failure, **retry preserves the same key and the exact immutable input**, and editing the preview/note is locked until the user cancels. A successful response creates a fresh key only for the next intentional issuance.
- Existing direct-issue versus pending approval flows, giver and recipient rules, approval/rejection/cancel, events ledger and historical marks are untouched. Existing confirmed stamp transformations are still owner-only; reservations, redemptions and peeled marks are non-editable.

### Contextual peeling

- Selecting a real stamp (tap or context-click/long-press where browser-supported) reveals only relevant actions.
- The owner of an active book can request peeling an **available** mark; a separate, initially unchecked acknowledgement and a second explicit confirmation are required to execute `peelLivingStamp`. The stamp is permanently unspendable; the existing RPC writes the peel event and keeps a visual trace.
- No client call can peel a reserved/redeemed/previously peeled mark, and successful Server Action permissions/version checks remain the same.
- The transform controls and page selector for eligible owner marks remain accessible through a collapsed detailed positioning panel.

### Page navigation, creation and ordering

- Left/right edges of the paper provide subtle dedicated tap targets; mobile left-edge rightward swipe and right-edge leftward swipe require deliberate horizontal travel (≥70 px and dominant horizontal movement). Both only exist in Select mode without an active selected object or stamp preview.
- Keyboard left/right arrows turn pages when the paper itself has focus and no object is selected. Existing explicit previous/next links and page indicator remain accessible.
- All page transitions use `pointplus:living-page-turn` events scoped to the current **page UUID** and are consumed by the existing `LivingPageManager`; it checks pending page/editor saves and unsaved stamp previews before navigation. Pen strokes, dragging decorations and stamp placing cannot accidentally trigger page turning.
- The folded corner on the final page directly submits the **existing idempotent** `AddLivingBookPageForm` once by invoking the underlying form, while keeping the full page overview and configurable form available.
- Page overview retains 36-at-a-time thumbnail windows and keyboard-accessible navigation. Owners may also drag one thumbnail onto another to reorder UUIDs through the existing owner-authorized `reorderLivingPages` RPC. Original move-up/down controls remain as a touch/keyboard alternative.

### Source and tests

- `features/living-books/stamp-gesture.ts` — pure, non-ledger preview geometry and stable UUID reordering.
- `features/living-books/m03-tools.tsx` — visual artwork tray, explicit idempotent confirmation, context-only peel consent.
- `features/living-books/paper-editor.tsx` — transient unissued stamp preview, paper-edge hit zones, preview exit/reopen and unsaved guards.
- `features/living-books/page-manager.tsx` — narrow, verified page-turn events, folded corner creation, thumbnail drag reorder.
- Scoped CSS in `app/(protected)/s/[spaceId]/stamp-books/stamp-books.css` for warm paper/ink look, accessible mobile sheet and reduced motion.
- `tests/living-v3-ux03-stamp-page.test.mjs` — executes stamp geometry and tests source contracts for the exact RPC/idempotency mechanism, peeling permissions, page-turn safety and stable UUID ordering.
- CI continues all UX01–UX02 and M01–M05 suites, TypeScript/Next.js Build and ephemeral PostgreSQL 16 RLS/concurrency tests.

**Outstanding before Production release:** true browser/device testing (iOS/Android, mobile drag, long-press, auth with two members, signed photos), and staged hosted Supabase Auth/RLS/Storage E2E. Source tests and CI are not evidence those manual interactions were performed. Follow-up UX04 must address final Rewards/Animation/Accessibility/E2E polish; it is **not started here**.

## UX04: reward redemption, accessible modal sheet and release testing

### Focused reward workflow

- The stamp balance button opens a **true modal** mobile bottom sheet, with backdrop, labelled dialog, keyboard focus entry/trap, Escape and overlay dismissal, trigger-focus restoration and background scroll lock.
- Three concise counters are visible: available, reserved, redeemed. Lifetime total and peeled marks are behind a small disclosure.
- The recipient chooses an integer quantity with number input and accessible slider, enters a free-form reward message and can inspect the real mark artwork preview before explicitly sending.
- An in-flight ref blocks duplicate clicks; when a network response is ambiguous the form freezes its original \`quantity\`, \`rewardMessage\` and \`idempotencyKey\` and can safely retry the *same* request. Starting a separate request requires a deliberate, warning-confirmed reset after inspecting history.
- The owner sees a compact pending-reward notification in the top balance control. Pending requests are fetched **separately** from the latest-40 event history, so old pending items do not vanish. The exact count comes from the database; a maximum of 100 pending items are rendered at once with an explicit truncation notice. Completing/canceling each request requires a **second, explicit confirmation**.
- Previous fulfilled/canceled requests remain permanently visible behind a collapsed history disclosure, with linked stamp preview and permanent used/canceled indicators. The book remains active after fulfillment.
- All ledger mutations still run through pre-existing **authorized server actions and PostgreSQL M04 RPCs**, with atomic mark UUID associations and RLS. No custom client-side spend or reverse-redemption functionality was introduced.

### Animation and accessibility

- Existing paper opening, stamp impact, peeling trace and used-stamp ink effects remain. Adds subtle, contextual sheet/backdrop/history motions; respects \`prefers-reduced-motion\`.
- Sound remains user-controlled, **muted by default**, optional WebAudio only, within the book overflow menu; no copyrighted samples or external URLs.
- UX04's modal uses real \`role=dialog\`, \`aria-modal\`, labelled heading, trap on Tab and Shift+Tab, Escape, visible focus indicators and focus return on close. Buttons and mobile controls meet ~44px touch target intentions. Readonly recipients cannot access owner actions.
- Owner and recipient actions display server feedback, keep version/conflict/ledger semantics, and avoid changing any pending status on the client before server success.

### Added/updated source

- \`features/living-books/editor-studio.tsx\` — managed modal and owner notification count.
- \`features/living-books/redemption-panel.tsx\` — focused quantity/reward UI, owner pending confirmations, collapsed history and immutable idempotent retry.
- \`features/living-books/redemption-data.ts\` — independent pending query, exact count and efficient artwork lookup.
- \`app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx\` — scoped pending-count props.
- \`app/(protected)/s/[spaceId]/stamp-books/stamp-books.css\` — bottom-sheet and reduced-motion polish.
- \`tests/living-v3-ux04-rewards.test.mjs\` — **real React server-rendering** of owner, recipient and read-only components plus accessibility/authorization source assertions, run automatically in CI.
- \`tests/e2e/living-v3-ux04-browser.mjs\` — **staging-only guarded Playwright E2E harness** for two real users, mobile viewport, reduced-motion, modal focus and a real one-stamp redemption/fulfillment. This test is syntax-checked in CI but **NOT EXECUTED** without an isolated hosted staging web app and two staging accounts.
- \`.github/workflows/ci.yml\` — UX01–UX04 and existing M01–M05 application/PostgreSQL tests and TypeScript/Next.js build on the feature branch (push trigger added because PR #31 was externally merged).

### Verification matrix and remaining release blockers

| Gate | Method | Status |
|---|---|---|
| UX01–UX03 contracts/geometry | GitHub Actions | Verified in previous CI and re-run on feature branch |
| UX04 actual React rendered owner/recipient UI | \`node --test tests/living-v3-ux04-rewards.test.mjs\` | Automated in CI |
| Existing M01–M05 contracts and SQL | Node + ephemeral PostgreSQL 16 + RLS/concurrency | Automated in CI |
| TypeScript and Next.js production build | \`npm run typecheck\` and \`npm run build\` | Automated in CI |
| Hosted Supabase Auth/RLS/Storage two-account E2E | \`npm run test:e2e:living\` | **BLOCKED: no verified isolated staging URL and credentials** |
| Real Playwright browser two-account redemption E2E | \`node tests/e2e/living-v3-ux04-browser.mjs\` | **BLOCKED: no isolated staging deployment, account credentials, or browser runtime configured** |
| Real iOS/Android multitouch, long press, responsive visual QA, screen readers | Device/browser QA | **NOT EXECUTED** |
| Original PR #31 remains Draft | GitHub API | **IMPOSSIBLE: external merge on 2026-11-21** |
| PR #29 stacked integration | GitHub API | **BLOCKED: closed without merging** |
| Production mutation by this UX work | None | **No Production data/schema changes, no merge/deploy performed by this execution** |

**Important:** These blockers MUST be resolved before presenting UX01–UX04 as Production-ready. CI tests and server-rendered React are NOT substitutes for real hosted/browser/device E2E. The staging E2E script explicitly refuses the live Supabase project and several Production aliases and must be run ONLY on a separately provisioned isolated environment.

## Stop policy

**All four UX milestones have implementation, CI suites and documentation. UX04 is the final milestone. Do not merge, deploy or apply SQL migrations automatically.** Preserve feature branch and all commits until the PR #31/#29 integration conflict has been reviewed by the user.
