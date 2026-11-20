# Phase 02 · Point+ Stamp Book UX

## Audit before implementation

Baseline: main at bc5c568. Public and auth layouts sit above a claims-protected shell. Rooms resolve membership server-side, Room layouts remember the last visited room per account, and the Stamp Book routes read existing Supabase records. Server Actions validate mutations and invoke scoped RPCs. The tracked creation SQL uses the first permitted stamp design as the cover.

| Area | Findings |
| --- | --- |
| Public and auth | Existing official Heart branding and Thai copy. Shared typography mixes Thai text with uppercase English labels, and the metadata still leads with missions. |
| Shell and Rooms | Sidebar turns into a wrapping header with sign-out competing for space on small screens. Room links lack selected state, cards omit the available membership role, and Room Home duplicates library cards with less information. |
| Library and detail | Library shows per-person values in a single text run. Archived books lose progress context. Detail has separate summary counts, slots and history, but slot dates are cramped and past stamp notes are harder to find. |
| Creation and stamping | Creation exposes every decision at once. Give Stamp shows duplicate errors and uses the same success treatment for pending and granted results. |
| Rewards and collaboration | Existing claim and fulfillment actions are separate. Reward options hide descriptions. Invitation copy feedback has a manual fallback, and notifications lack strong unread hierarchy. |
| UI states | The app has shared buttons, cards, fields and native dialogs. Styles diverge across the Stamp Book and shared surfaces. Rooms and Stamp Books need route-level loading and retry states. |

Older mission, activity, campaign and reward paths retain their current routing and permissions. This refactor works through the primary Rooms and Stamp Book journey.

## Implementation

Branch: `feat/p02-stamp-book-ux-refactor`.

- The desktop sidebar and mobile bottom bar expose Rooms, notifications, and profile. On mobile, the bar has its own row outside the scrolling content. Room navigation identifies the current section, and the existing per-account Room resume preference remains limited to accessible Rooms. Personal rooms are now discoverable on the Rooms page.
- Room Home and the library use one bookshelf component. Active and paused books appear in the primary shelf. Archived books have a labeled disclosure. Progress is based on the latest visible cycle per book and participant, and is omitted when no cycle is available. Archived participant history can still be displayed where the existing read policies allow it.
- The wizard keeps inputs mounted between stages and validates each visible step. Its final submission calls `createStampBookAction` with the existing fields. The chosen cover is included first in `p_styles`, so it remains an available stamp design. Couple rooms retain their single partner recipient, creator as giver, direct stamping, one-time completion, and free-text memory reward. The submit lock prevents repeated clicks while a request is in flight, and the route changes only after a book ID is confirmed.
- The journal uses stored book, cycle, mark, and claim records. Current and past cycles show their own progress and the available stamp notes, dates, and givers. The Give Stamp sheet distinguishes granted, pending, rejected, and failed results. Reward selection and fulfillment use their separate existing actions. Existing claim statuses remain explicit.
- The members page surfaces recorded roles. Invitation copying has temporary feedback and manual fallback. Joining accepts an invitation link or code and still uses the same authentication and invitation RPC. Notifications use real records with a text unread state and a retryable read action.
- Warm cream surfaces, deep coral controls, semantic state colors, and locally hosted Noto Sans Thai form the shared design system. The local font distribution includes its SIL OFL 1.1 terms. Shared styles cover buttons, fields, cards, focus rings, and statuses. Reusable components cover selected navigation, headers, segmented fields, book covers, and participant progress. The native Give Stamp dialog becomes a sheet on narrow screens.
- Protected routes provide a loading skeleton, connection retry screen, and a recovery view for unavailable Rooms and books.

## Verification

| Check | Outcome |
| --- | --- |
| `npm ci` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `node --test tests/*.test.mjs` | 65 passed |
| `node scripts/validate-point-plus-assets.mjs` | Passed for all 18 stamp and 12 badge designs |
| Chromium browser fixture | Passed at 320, 375, 390, 768, 1024, and 1440 px |
| axe-core at 390 px | No WCAG 2.0/2.1 A or AA findings on the eight scanned views |

Chromium checked Thai content and horizontal overflow on the public landing page, login, Rooms, Room Home, library, wizard, journal, members, notifications, and invitation join. It verified 44 px main navigation targets, non-overlapping mobile navigation, the keyboard skip link, dialog focus entry and return, Escape dismissal, and correct access recovery. The suite ran with reduced motion enabled. The eight axe scans cover Rooms, Room Home, library, wizard, journal, members, notifications, and join. Manual screen reader sessions, physical device checks, and Safari and Firefox runs remain unexecuted.

Interaction checks covered the authentication redirect, Room resume, opening an archived book, per-participant progress, wizard validation and state retention, one action after a double submit, retries after an action error, final RPC payload and navigation, stamp history, a pending stamp with unchanged progress, reward request and fulfillment, invitation copy and one-use response, and notification read state. The browser suite starts a local Supabase protocol fixture. It exercises the application and Server Actions with isolated test records.

To rerun the browser suite from the repository root, use an installed Chromium binary and the following commands. Stop any active Next.js development server for this checkout before running the suite.

```bash
npm install --prefix /tmp/pointplus-browser playwright-core@1.65.1 axe-core@4.14.1
POINTPLUS_PLAYWRIGHT_CORE=/tmp/pointplus-browser/node_modules/playwright-core/index.mjs \
POINTPLUS_AXE=/tmp/pointplus-browser/node_modules/axe-core/axe.min.js \
POINTPLUS_CHROMIUM=/usr/bin/chromium \
node tests/browser/phase02.mjs
```

Set `POINTPLUS_SCREENSHOTS` to a writable directory to capture screenshots. The example data in the checked-in images belongs to the browser fixture.

## Screenshots

| Interface | Mobile | Desktop |
| --- | --- | --- |
| Rooms | [390 px](screenshots/phase02/rooms-390.png) | |
| Room Home | [390 px](screenshots/phase02/room-home-390.png) | |
| Library | [390 px](screenshots/phase02/library-390.png) | [1440 px](screenshots/phase02/library-1440.png) |
| Wizard | [Book identity](screenshots/phase02/wizard-390.png), [Review](screenshots/phase02/wizard-review-390.png) | |
| Journal | [390 px](screenshots/phase02/journal-390.png) | [1440 px](screenshots/phase02/journal-1440.png) |
| Stamp and reward | [Give Stamp](screenshots/phase02/give-stamp-390.png), [Reward selection](screenshots/phase02/reward-selection-390.png) | |

## Changed areas

- `app/(protected)/` contains the shell, navigation, route fallback states, Rooms, Room Home, members, library, wizard entry, and journal. Stamp Book styles load at the Room layout so cards share the same design in both views.
- `app/globals.css`, `app/layout.tsx`, `components/ui/`, `components/brand/pointplus-mark.tsx`, and `public/fonts/` contain shared design changes and the local Thai font.
- `features/rooms/presentation.ts`, `features/spaces/data.ts`, and `features/stamp-books/` contain the presentation, cycle views, wizard, and server-confirmed feedback. Participants remain scoped to their Room, and stamp eligibility and reward mutations stay subject to the existing RPCs.
- `features/invitations/` and `features/social/notification-center.tsx` contain the collaboration UI changes.
- `tests/stamp-book-first-contract.test.mjs` and `tests/browser/phase02.mjs` cover the revised UI and action behavior.

## Remaining verification

The cloud egress proxy returned HTTP 403 for the hosted Supabase project. Live Supabase authentication, RLS enforcement, and two-account workflows remain unverified. The browser fixture does not establish production permissions or atomicity. The tracked SQL and contract tests remain the source for those contracts, and the creation wizard's first-style cover behavior comes from the tracked RPC definition. Existing query limits still bound how much history is retrieved on one page.

No live database writes, migrations, Vercel deployments, or merges were performed.
