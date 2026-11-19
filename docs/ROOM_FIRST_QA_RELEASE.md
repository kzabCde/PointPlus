> **Current DB reconciliation (2026-11-20):** Supabase access is restored and v3.1/v3.2 have been applied; see [DATABASE_V3_LIVE_AUDIT.md](DATABASE_V3_LIVE_AUDIT.md). The original unverified-DB notes below are historic. Multi-account E2E, backup restoration and production release approval remain outstanding.

# POINT+ — R01–R08 QA, Security, Performance and Release Handoff

Updated 2026-11-20. PR #10 was merged to main on 2026-11-19 by a separate action. Database v3 changes are isolated in `feat/database-v3-room-first-schema` and NOT applied to Supabase.
Production deployment **NOT AUTHORIZED**. GitHub actions checks are source-level CI, **not** live Supabase End-to-End.

## Implementation status at source-code level

| Mission | Implemented in branch | Outstanding release blockers |
|---|---|---|
| R01 — DB and Rooms | Proposed additive `group` CHECK migration; existing Personal Space remains intact | Inspect actual target schema and RLS; apply tested migration to target only |
| R02 — Room login | Auth redirect to `/rooms`; legacy dashboard redirect; no all-space board fetch; Resume Room checks authorized list | Live login/new user/profile/onboarding browser tests |
| R03 — Room home | Scoped recent activities, lightweight nav, Room switching | Cross-device/mobile UX checks |
| R04 — Invitations | Retains v2 token-hash one-use invite/accept RPC; create routes through Room members | Live 2+ accounts, couple limit, guardian tests, group invitation test |
| R05 — Missions | Reuses existing mission creation/submission/review; 18 official Thai templates by category | Verify real DB seed/card RLS and mission workflow on deployed test target |
| R06 — Stamps and Badges | Official JSON catalog: 18 stamp and 12 badge versioned rules; collection reads actual DB achievements; staged official catalog SQL | SQL migration approval and real atomic/idempotent earning/unlock tests |
| R07 — Personal rewards | Real Room catalog, create, redeem, fulfill and refund through v2 RPCs | Live concurrency, insufficient points, double redemption, stock and RLS tests |
| R08 — QA and performance | GitHub CI unit/contract, typecheck, production build, asset validation, bounded Room Home query | Real latency baseline, before/after measurement, mobile/browser E2E and security audit |

## Verified source-level assurances

- Original 18 stamp and 12 badge visuals remain untouched, with SVG and PNG variants.
- Group rooms map to Personal collection per participant; preserving original Personal Space kind.
- `/rooms` only loads Room metadata. No multi-Room mission or wallet fan-out on Login.
- Membership is checked by `getSpaceContext`; participant and reward IDs get additional scope validation.
- User-submitted mission proofs use the existing v2 private storage and original RPC.
- No service-role key added; no cash, merchants, marketplace, or monetization.
- Earned-state is never fabricated when official catalog entries do not exist in DB.

## Critical DB rollout procedure (once correct project is connected)

1. Confirm Supabase project REF is **gczribbtkfvhpzzupqre**, not AirQuality `qtcptorlmteydcslveqm`.
2. Read-only inspect `public.spaces`, `space_members`, `participants`, mission-related tables, `badge_definitions`, `point_wallets` and `stamp_cycles`. Verify functions and policies match source v2 before migration.
3. Take approved restorable backup (including DB and storage metadata); test rollback in isolated environment.
4. Apply `supabase/proposals/room_first_group_kind.sql` after review, first in isolated PointPlus test database.
5. Apply `supabase/proposals/room_first_official_catalog_v1.sql` after separately reviewing triggers, grant model, idempotency and existing records.
6. Confirm exactly 6 official stamped cards and 4 official badge definitions per Room with matching `image_key`, `slug` and `space_id`. Legacy cards and history remain.
7. Run Supabase security and performance advisors and verify RLS policies. Do not execute raw SQL against unrelated target.
8. Repeat E2E with at least two adult users and a Family guardian/child test fixture; verify no data crosses Rooms, and that user-2 cannot view user-1 private evidence.

## Required E2E / adversarial cases

- Register/login -> Rooms, completed onboarding, no redirect loop.
- First shared Room: couple/family/group; second Room; switching; recently used Room.
- Invitation via token hash, expired/reused tokens, couple max 2, unauthorized member action.
- Mission draft -> active; authorized submit -> review by permitted other member; prevent self-approval; repeat/weekly/day timezone.
- 18 official stamp cards can earn, all 12 badge conditions can unlock, including group per participant and retained legacy Personal Space.
- Replay identical submission and review IDs, simultaneous review clicks and redemption double-click: no duplicated points, stamp cycles, badges, or refunds.
- Wrong room_id, reward_id, participant_id, mission_id requests must not leak data.
- Guardians see permitted children, unconnected adults cannot read child profiles, private proofs or wallets.
- Retire/revoke member permissions and other social safety policies need a separately reviewed DB extension if required.
- Accessibility: keyboard-only, reduced motion, 320/375/768/1280px widths, empty states, slow/failed network and loading indicators.

## Performance measurement procedure

Record environments, cache state, project and device before each comparison:
- `GET /rooms`, `GET /s/{spaceId}`, `GET /s/{spaceId}/missions`, `GET /s/{spaceId}/collection`
- Authentication time, Server TTFB, requests/query count, PostgREST errors, median and p95 request latency.
- Test 0, 1, 5, 20 Rooms and at least 100 missions for each Room using authorized fixtures.
- Measure baseline on the same environment/version before claiming speedup; compare with Room-first implementation and save measurements in PR comments.
- Verify Mobile Core Web Vitals and room switch responsiveness.
**No live timing data has been measured through current tools. Do not publish fabricated performance metrics.**

## Release gate

`main` merge is blocked until both migrations pass **correct target** preproduction, real E2E and RLS tests pass, CI is green, performance comparisons have measured results, and user explicitly authorizes release.
Keep Vercel Preview disabled. Do not trigger Production deployment, even if GitHub CI passes.
