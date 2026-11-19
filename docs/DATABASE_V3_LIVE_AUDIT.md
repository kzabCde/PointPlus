# Point+ — Live Database v3 Audit and v3.1/v3.2 Reconciliation

**Verified:** 2026-11-20 (Asia/Bangkok) via connected Supabase account **Que168**  
**Target:** `gczribbtkfvhpzzupqre` (`pointplus`)  
**Repository:** `kzabCde/PointPlus` — draft PR #11, branch `feat/database-v3-room-first-schema`.

## Observed source-of-truth and changes

The live database already contained **v3**, applied outside Supabase's migration history: 23 public tables (all with RLS and policies), 41 public RLS policies, `spaces.kind` accepts `group`, `room_preferences`, `pointplus_private.official_assets` with **18 stamp + 12 badge** entries and 6/4 official records on its current Personal Space. Do **not** run `supabase/v3/02_upgrade_proposal.sql`, `supabase/proposals/room_first_group_kind.sql` or `room_first_official_catalog_v1.sql` against this project.

Initial audit discovered the `pointplus_official_assets_new_space` trigger was **disabled** and all 6 official stamps and 4 official badges on the existing Space were **inactive** (consistent with a previous official-feature pause). This prevents new shared Rooms receiving their complete official collections and prevents selecting official stamps for missions. A transactionally rolled-back restoration successfully proved provisioning and earning before the live feature was re-enabled.

The original `features/spaces/actions.ts` used `INSERT spaces ... RETURNING id`. On a new Space, the `spaces_read` policy requires membership, but `pointplus_on_space_insert` creates membership in an **AFTER INSERT** trigger, after Postgres checks SELECT/RETURNING visibility. Under `SET LOCAL ROLE authenticated`, the exact behavior was reproduced: `new row violates row-level security policy for table "spaces"`. In the draft PR, the server now generates `randomUUID()`, inserts with that ID **without RETURNING**, and returns the known ID after success.

## Applied live migrations (Supabase migration history verified)

| Version | Name | Effect | Rollback |
| --- | --- | --- | --- |
| `20261119180914` | `pointplus_v3_1_assignment_notifications_security_hardening` | Adds assignment notification trigger; removes anon/authenticated execute on `public.rls_auto_enable()` | `supabase/v3/06_assignment_notification_rollback.sql` (does not re-open execute by default) |
| `20261119181601` | `pointplus_v3_2_resume_official_collections` | Re-enables official collection seed trigger, activates only official stamp/badge catalog rows | `supabase/v3/08_pause_official_collections_rollback.sql` |

The exact forward scripts are `supabase/v3/05_live_assignment_notifications_hardening.sql` and `supabase/v3/07_resume_official_collections.sql`; migration history above comes from `list_migrations`. Existing identity, rooms, members, missions, wallet rows, point ledger, stamps and badges were preserved. There is no destructive table rebuild.

**Important migration baseline gap:** prior v3 objects were installed before Supabase migration history began. Fresh database setup cannot safely use only these two incremental migrations. Reconcile the existing baseline with a restorable clone before designing clean-room bootstrap migrations or using `supabase db push`.

## Post-change verification

- Official seed trigger `tgenabled = O` (enabled); current Space: 6 active official stamps and 4 active official badges.
- Security-definer `public.rls_auto_enable()` is no longer executable by `anon` or `authenticated`; private assignment notifier likewise not callable directly.
- Security advisor warnings reduced **3 → 1**: remaining warning `auth_leaked_password_protection` is a **Supabase Auth project setting**, not SQL schema; per current Supabase docs, leaked password protection is offered on Pro and above.
- Health advisor reports no findings.
- RLS role-context tests inside rollback-only SQL transactions passed: an unknown signed-in user could not see Rooms/Members/Participants/Missions/Stamps/Wallets/Notifications, and existing account access to owned profile/Space/membership/catalog succeeded.
- **After-live-migration transactional smoke PASS:** insert Group Room (no RETURNING) → owner membership → participant/wallet → six active official stamps/four active official badges. Existing Personal Space transaction: create active Mission with 10 Points + 1 Stamp → submit → auto-approve → exactly one point transaction → wallet +10 → exactly one stamp award → `personal-fresh-start` badge unlock. All test writes explicitly **ROLLED BACK**.
- Rechecked persistent state: **1 Room; 0 submissions, transactions, stamp awards, and unlocked badges** (no test data was retained).

## R01–R08 readiness

| Mission | Live DB | App code / remaining |
| --- | --- | --- |
| R01 Room foundation | Group kind / Membership / participant provisioning confirmed; new official catalog enabled | Room create `INSERT RETURNING` fix is **in draft PR only**, not deployed |
| R02 Login / resume | Room preferences table and RLS verified | Browser login/onboarding/resume test still needed |
| R03 Room home | Scoped tables & policies present | Real device UI and p95 metrics not measured |
| R04 Invitations / members | `pointplus_create_invite` and `pointplus_accept_invite` RPCs exist with hashed tokens; couple limit in function | Requires two real accounts, expired/reuse, roles, guardian/child tests |
| R05 Missions / approvals | Personal submit → auto-review works in rolled-back transaction | Shared-Room independent reviewer, timezone and concurrent replay remain |
| R06 Stamps / badges | 30 catalog items; 6/4 active per current Space; first personal award verified in rollback | 18/18 Stamp and 12/12 Badge scenarios across Room types still needed |
| R07 Points / rewards | Personal points ledger and wallet +10 verified in rollback; redeem/fulfill/cancel RPCs exist | Full reward/stock/double-refund concurrency still needed |
| R08 QA & release | Source CI and TypeScript build in GitHub; role-context RLS smoke passed | Multi-account real session E2E, independent restorable backup, storage privacy, performance baseline, production deployment approval |

## Safety and rollout gate

**Do not merge PR #11 or deploy Vercel Preview/Production yet.** The live DB is migrated but the Next.js Room creation fix is not on `main`. CI is source-level; it is not a real end-user E2E test. Full backup restore on an isolated database and two-plus independent Auth sessions have **not** been verified. No Supabase development branches were present when checked.

To pause official features without data loss use `08_pause_official_collections_rollback.sql` after reviewing current state. To roll back v3.1 notifications use `06_assignment_notification_rollback.sql`. Neither deletes user data, point history or awards. Do not reset a live schema or drop group kinds without inventorying dependent data.

Supabase Auth leaked-password setting: see [password security](https://supabase.com/docs/guides/auth/password-security); enable in Auth dashboard if plan supports it. No plugin action to modify this project setting was available through the currently connected Supabase tools.
