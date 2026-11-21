# Point+ — Living V3 Paper First / Buttonless integration

## Canonical scope

Integration branch: `feat/living-v3-buttonless-integration`, targeting `main` via
[Draft PR #34](https://github.com/kzabCde/PointPlus/pull/34).
Base Production commit: `92044433d5d49b32a838c4426c32db6fa62143fd`.

Restore UX01–UX04 from `feat/living-v3-buttonless-ux` without merging PR #33 or
overwriting the Living V3 card rewrite delivered by PR #32. No application
Production deployment, no SQL migrations and no Production data writes.

## Implementation

- UX01: Paper First reader, minimal header, focused action entry and contextual
  controls only when needed.
- UX02: Selected-object floating toolset, direct manipulation, text in place,
  photo crop, stroke editing and autosave/retry history.
- UX03: Official stamp artwork tray, on-paper unissued preview, explicit real
  stamp confirmation, peel confirmation and safe page edge gestures.
- UX04: Focus-managed reward modal, reduced-motion support, recipient and owner
  actions, retry-safe idempotency, pending requests and immutable redemption marks.
- V3 card: printed numbered stamp slots; tapping an empty slot opens an
  artwork sheet rather than a permanent form; confirmed issuance still goes
  through `giveLivingStamp` / `pointplus_give_living_stamp`. Occupied and pending
  slots cannot be reused, and card redemption remains fixed to the M23 target
  and reward via SQL authorization.
- The same reward modal works for both fixed-target cards and unlimited books.

## Tests

CI `verify` executes original foundation, Room, M01–M05, M23 card contracts,
UX01–UX04 and V3 card Buttonless React SSR tests. `verify-living-migrations`
runs the full M01–M05/M23 SQL fixture on isolated PostgreSQL. Both must pass on
the final commit; TypeScript typecheck and Next.js production build must pass.

Two independent **staging-only** E2E scripts:
- `tests/e2e/living-v3-ux04-browser.mjs`: A/B reward request and settlement,
  modal focus, reduced motion on desktop/mobile.
- `tests/e2e/living-v3-card-buttonless-browser.mjs`: A desktop and B touch/mobile,
  slot selection, artwork sheet, Escape, permitted issuance, approval and exact
  one-mark ledger receipt.

These browser scripts are syntactically checked in CI but deliberately **not
executed automatically**. They require isolated Staging web deployment,
Staging Supabase project, two dedicated staging accounts, room/book fixtures and
reviewed secrets. Verify that the **web app itself** is configured with the
Staging Supabase project; passing a staging Supabase URL to an E2E client does
not make an incorrectly configured web app safe. Never point these E2E tests
at the Production Supabase ref `gczribbtkfvhpzzupqre`.

## Remaining release gates

- Run both staging scripts against their own isolated data.
- Manually verify desktop, phone-width, touch, keyboard and reduced-motion
  navigation, stamp tray/preview, undo/autosave and reward flow.
- Verify A->B and B->A reciprocal books/cards, eligibility, pending approval,
  fulfill/cancel, retry conflicts, event history and permission denial.
- Review release diff; preserve historical stamps, Room membership and all
  real-stamp audit trails. No merge or deployment while Draft.
