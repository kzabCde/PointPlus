# Phase 03 · Stamp Book motion and reference review

## Starting point

The implementation starts at `ef998aa`, which merged the Phase 02 work in PR #16. Phase 02 had real Room and Book records, a working three-step Server Action form, approved and pending stamp states, and the original Heart and artwork. The detail page displayed all slots in one grid, with older cycles in a disclosure. It had no page controls or placement feedback. The new branch is `feat/p03-stamp-book-motion-system`.

I used the pasted brief as the work request and the ZIP as reference material. I reviewed its seven original PNG boards, the playground HTML/CSS, its source catalog, and its motion token notes. The environment proxy returned HTTP 403 for the Lettre, Dribbble, Codrops, Motion, and LottieFiles pages and linked image previews, so the external works themselves were unavailable.

| Reference material | Application to Point+ |
| --- | --- |
| Room Home and library boards | A tucked-in journal cover, clear per-person progress, and an archive shelf. Room Home can feature a book with real progress from its current data. |
| Create Book board | A clear three-stage indicator, selectable participant rows, a cover preview, and one final submission. |
| Physical detail board | A bound paper spread with slots on one leaf and dates, givers, and notes on the other. Filters and page controls stay outside the movement. |
| Impact and page-turn storyboards | A 450 ms landing on the matching persisted slot and a directional, decorative leaf sweep near the binding in 600 ms. |
| Reward storyboard | A restrained reveal that distinguishes a stored request from a fulfilled reward. |

The offline boards establish composition and timing. The shipped images come from the existing Point+ asset registry.

## Implementation

- The library and Room Home share portrait covers with the original artwork. The library has a separate archived shelf. The Room highlight uses an eligible participant's open cycle, preferring the signed-in participant when a cycle is available.
- The wizard keeps its canonical creation action and single-submit guard. It carries settings between steps, previews the selected cover and artwork, and presents eligible participants in touch-friendly rows. A Couple book still selects one eligible partner.
- The detail route renders up to six slots per leaf and gives each visible cycle access to its stored stamps, giver names, timestamps, notes, and reward status. Users can turn pages with buttons, arrow keys, Home and End, or a horizontal swipe. The page counter and content update immediately. Reduced motion preserves the controls and skips the leaf, impact, and reward effects.
- A stamp placement needs the approved request ID returned by the existing action and a visible mark with that request ID. When the final stamp opens a repeat cycle, the journal stays on the completed cycle and turns to the page containing the mark. A replay of an already visible request leaves the settled stamp in place. Pending, rejected, and denied requests do not enter the placement path.
- A reward reveal needs a successful claim or fulfillment action and the matching refreshed record. A requested reward shows that delivery is still due. Fulfillment has its own reveal. Canceled claims keep their text status. Existing reward administration still surfaces all pending requests.
- Timings and easing are centralized in `app/motion.css`. The effects use CSS transforms and opacity. No animation library or reference artwork was added.

## Permissions and remaining verification

The UI continues to use the existing Supabase actions and policies for creation, stamping, approval, rewards, invitations, and book access. The checked-in Couple contract supports each partner creating a separate book for the other. It restricts the memory reward to the eligible recipient and stores the completed book in the archive. The implementation kept those paths and their existing contract tests.

The hosted project `gczribbtkfvhpzzupqre` was inaccessible from this environment. The proxy returned HTTP 403 on a read-only health request. Browser results come from the local fixture and leave live authentication, RLS enforcement, and reciprocal two-account flows unverified. The existing bounded history reads still apply.

## Validation

| Check | Result |
| --- | --- |
| `npm ci` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `node --test tests/*.test.mjs` | 68 passed |
| `node scripts/validate-point-plus-assets.mjs` | Passed for all 18 stamp and 12 badge designs |
| Chromium layout | Passed at 320, 375, 390, 768, 1024, and 1440 px |
| axe-core at 390 px | No WCAG 2.0/2.1 A or AA findings on ten scanned views |

The fixture checks mouse, keyboard, touch, reduced motion, stable spread size, wizard retries and duplicate submission, historical cycles, exact confirmed placement, request replay, reward request, fulfillment, and cancellation, and existing invitation and notification flows. Browser timing uses elapsed wall time between animation events. The page turn, stamp impact, and reward reveal measured 600 ms, 433 ms, and 895 ms in the final run. The tested grant and reward paths recorded zero non-input layout shift. These are local Chromium fixture measurements. Manual assistive-technology sessions, Safari, Firefox, and physical-device runs remain unverified.

Run the browser suite with the setup documented in [the Phase 02 report](PHASE02_UX_UI_REFACTOR.md). Set `POINTPLUS_SCREENSHOTS` to a writable destination outside the checkout if you want new captures.

No database migrations, live writes, Vercel deployments, or merges were performed for Phase 03.
