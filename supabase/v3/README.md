# Point+ Database v3 — Live Operator Runbook

**Updated:** 2026-11-20 · Target `gczribbtkfvhpzzupqre` (Que168).

For exact live findings and release gates see [DATABASE_V3_LIVE_AUDIT.md](../../docs/DATABASE_V3_LIVE_AUDIT.md).

## Live state

The actual Supabase project **already has v3** (23 public tables, `spaces.kind='group'`, private 30-item official catalog, room preferences and v3 triggers). Initial database work predates Supabase's migrations ledger; **the original v2 → v3 proposal is NOT safe to apply on this target.**

Two incremental migrations were applied and verified:

| Supabase migration version | SQL checked into repository | What changed |
| --- | --- | --- |
| `20261119180914` | `05_live_assignment_notifications_hardening.sql` | Assignment notifications; revoke broad `rls_auto_enable()` execute |
| `20261119181601` | `07_resume_official_collections.sql` | Resume disabled official seed trigger and activate original official Stamp/Badge rows |

Both have feature-preserving rollback counterparts: `06_assignment_notification_rollback.sql`, `08_pause_official_collections_rollback.sql`.

## Historic files — do not run on the live PointPlus DB

- `01_audit_readonly.sql`: historic initial discovery query; safe read-only
- `02_upgrade_proposal.sql`: **v2 baseline only, obsolete for this target, do not apply**
- `03_verify_readonly.sql`: read-only post-v3 integrity checks
- `04_safe_rollback.sql`: historic non-destructive v3 official catalog pause, NOT a database rewind
- `supabase/proposals/room_first_group_kind.sql`: **obsolete, already present**
- `supabase/proposals/room_first_official_catalog_v1.sql`: **obsolete, already present**

DO NOT run incremental migrations twice and never use the AirQuality project.

## Verified transactional smoke tests

Through `SET LOCAL ROLE authenticated` with a valid existing user context, executed **BEGIN ... ROLLBACK** tests:

1. Generated UUID + `INSERT INTO spaces` **without RETURNING** provisions group Room, owner membership, participant, wallet, 6 active official stamp cards, and 4 active official badge definitions.
2. Existing Personal Space: draft independent Mission → submit/autoapprove → single +10 point ledger entry, wallet +10, one Stamp award and first-stamp Badge unlock; all reverted at transaction end.
3. Nonmember authenticated context sees no Room/Mission/Wallet/stamp data. Existing owner context sees their Room/Profile/Membership.
4. Database unchanged by smoke tests.

These tests **are not substitutes** for two distinct real Auth sessions, cross-Room isolation, Couple invitations, guardian protections, concurrency or frontend browser testing.

## Release gate

- Keep PR #11 **draft**, don't merge/deploy Preview/Production before release.
- `features/spaces/actions.ts` in PR #11 avoids Room `INSERT ... RETURNING` RLS failure; production UI has not received this code yet.
- Verify backed-up restore to separate PointPlus database; Supabase branching currently not configured.
- Verify 2+ real Auth users, Room create → Invite → Mission → Review → Stamp/Badge → Redeem.
- Capture real latency baseline and rerun CI. Only then consider release authorization.
- Security advisor currently has one remaining Auth setting warning: leaked password protection (Supabase plan-dependent).
