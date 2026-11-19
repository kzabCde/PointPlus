# Room-First Refactor — Implementation and release gate

**Branch:** `feat/room-first-complete-experience` (unmerged)
**Target DB:** PointPlus `gczribbtkfvhpzzupqre` only.
**User-visible Rooms:** `couple`, `family`, `group`.
**Existing `personal` Spaces:** preserved, not presented as shared Rooms.

## Audit of main

- Database v2 uses `spaces.kind` text with the three-value CHECK `personal,couple,family`.
- All authenticated accounts get a Personal Space from the signup trigger; do not remove it.
- `listMySpaces` resolves user memberships and accessible spaces with two queries.
- Previous `loadDashboard` queries every Space's mission board, member count and wallet (N+1).
- Invites use one-use fragment tokens and the secure `pointplus_create_invite` and `pointplus_accept_invite` RPCs.
- Official manifests contain **18 stamps + 12 badges**: `couple`, `family`, `personal`.
- Database v2 badge rarity is `common,rare,epic,legendary`, whereas static badge art has `bronze,silver,gold,diamond`; never assume these enums match.
- Stamp-card `image_key` and badge-definition `image_key` are optional, and asset IDs are NOT database UUIDs.
- PointPlus project has not been accessible to the linked Supabase connector; live schema, RLS and migrations are **unverified**.

## Mission gates
| Mission | Planned acceptance |
| --- | --- |
| R01 | Migration adds `group` without rewriting rows; audited RLS and triggering |
| R02 | Login/onboarding -> My Rooms; no cross-Room data fetch |
| R03 | Current Room home, minimal navigation, responsive design |
| R04 | Invite/accept flows, multi-room access, role/guardian boundaries |
| R05 | Existing missions/submission/review RPCs integrated, no parallel source of truth |
| R06 | All 18 stamp and 12 badge asset IDs mapped to earned, versioned database rules |
| R07 | Redeem/fulfill/refund with ledger, private reward gallery |
| R08 | Runtime profiling, cross-Room adversarial RLS, mobile E2E, CI and single production release approval |

## Deployment policy

Do not merge into `main`. Do not create Vercel Preview or Production deployments.
Review and test all migrations against the **correct** project with permission before any execution.
CI/typecheck alone does not validate live RLS or stamp/award behavior.
Run one approved Production deployment only after complete release acceptance.

## Stamp mapping
- `couple` Rooms -> `couple` collection
- `family` Rooms -> `family` collection
- `group` Rooms -> `personal` collection scoped per participant
- `personal` legacy Spaces -> `personal` collection

Artwork and IDs are immutable. Asset registry is `lib/point-plus/assets.ts`.
Only persisted, authorized DB records can indicate progress, awards, redemption and unlocks.
