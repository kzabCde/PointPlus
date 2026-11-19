> **Live status update (2026-11-20):** The older “NOT verified” statements below describe the earlier blocked-connector investigation. Connection is now confirmed; official v3 objects already existed and two incremental migrations were applied. Refer to [DATABASE_V3_LIVE_AUDIT.md](DATABASE_V3_LIVE_AUDIT.md) for current authoritative findings, migrations and release blockers. Do not reapply the canonical v2→v3 proposal.

# Point+ — Database v3 delta, live verification and rollback plan

## 1. What is confirmed vs not confirmed

| Evidence | Status | Provenance |
| --- | --- | --- |
| Original schema contains 22 public v2 app tables and 9 public RPC wrappers | **Verified (source)** | Supplied `pointplus_database_v2.sql` |
| `spaces.kind` v2 CHECK allows only personal/couple/family | **Verified (source)** | v2 `public.spaces` DDL |
| Member/participant/guardian model, personal signup trigger and private point-ledger transactions | **Verified (source)** | v2 DDL, functions, triggers |
| All 18 Stamp IDs + all 12 Badge IDs & v1 rule JSON | **Verified (repository)** | GitHub manifests |
| Existing `main` contains earlier proposed group and official catalog SQL but they are not proof of deployment | **Verified (repository)** | `supabase/proposals/*` |
| Live columns, constraints, RLS, triggers, existing data, function definitions, index sizes | **NOT verified** | Target Supabase project connector currently returns `link_id must identify an eligible linked account` |
| SQL v3 migration applied to project | **NO** | No database write has been made |
| Live user-to-user RLS and earning QA | **NOT verified** | Must test on isolated PointPlus clone and real authorized target |

**Project guard:** PointPlus target `gczribbtkfvhpzzupqre` only. The AirQuality database project is unrelated and must NEVER be modified for Point+.

## 2. Structural delta (baseline v2 -> v3 design)

| Area | v2 | v3 (proposal) | Destructive? |
| --- | --- | --- | --- |
| `spaces.kind` | personal/couple/family | also group; no rename | No; verified CHECK replacement |
| `profiles`, `spaces`, `space_members`, `participants`, `child_profiles`, `space_invites` | existing | keep originals | No |
| `room_preferences` | absent | one per user, last_room FK to actual membership | Additive |
| `stamp_cards` | image_key nullable | official rule version field + 6 cards per room | Additive |
| `badge_definitions` | 5 criteria | add 2 official criteria and rule version/required stamp; 4 definitions/room | Additive CHECK extension |
| `pointplus_private.official_assets` | absent | private versioned 30-key catalog | Additive |
| `evaluate_badges` | 5 built-in criteria | preserve 5; add official rules with approved-award counts | Function replacement, rollback by restoring prior definition |
| `point_wallets`, `point_transactions`, `stamp_awards`, `stamp_cycles` | existing | preserve transaction sources and rows | No |
| `rewards`, `redemptions`, `stamp_prizes` | existing | no new payment/commerce tables | No |
| Other tables & security | v2 | preserve RLS, selective integrity/index checks | No |

Counts after catalog seed: **six official stamps + four official badges per Room**, on top of legacy 5/10 cards and five global baseline badges (which remain visible if eligible).

## 3. Detect drift before approving SQL

1. Fix Supabase account OAuth/permissions so the connected project ref is visible and matches PointPlus.
2. Run **only** `supabase/v3/01_audit_readonly.sql` on target. It returns metadata, duplicate asset IDs, RLS status, triggers/RPC properties and aggregate row counts — no user PII.
3. Compare exact constraint names and definitions against v2 baseline, especially `spaces_kind_check` and `badge_definitions_criterion_check`.
4. Confirm whether anyone previously ran either earlier `supabase/proposals/*` migration. If applied, STOP: reconcile data and skip duplicate DDL; do not blindly rerun canonical script.
5. Inspect `pg_policies`, function owners, `prosecdef`, grants, storage bucket policy and all scoped foreign keys. Keep read-only audit output with timestamps in release checklist.
6. Measure backup availability, disk quota, table sizes, migration runtime/locks. Plan maintenance window if necessary.

## 4. Backup, testing and one-way data safety

- Create restorable backup **before** migration, including Auth/Storage dependencies, using Supabase backup/restore or CLI export supported by the project's plan. Verify a successful restore to a separately isolated database. Supabase does not promise that the point-in-time backup can reverse every external side effect or storage item automatically.
- Make no production writes before the project ID and backup are verified. Test canonical v3 SQL on a v2 fixture or isolated clone, then run `03_verify_readonly.sql`.
- On failure *within* the migration transaction, PostgreSQL rolls back the whole transaction. No manual drop is needed.
- After commit and user activity, **never delete** v3 data merely to restore an old schema. Use `04_safe_rollback.sql` to disable future official seeding, retain all existing rows, revert app feature flag, and plan a verified corrective migration; do not drop `group` CHECK if group rooms exist.
- Reverting `evaluate_badges` to v2 requires restoring the **captured pre-migration function definition** from audited backup; this cannot be safely auto-generated without live inspection. The rollback script deliberately does not rewrite it.
- Rollback is a **feature rollback**, not full database rewind. A full logical/physical rewind must use the tested backup and account for writes since backup; require operator approval.

## 5. Acceptance & blockers

No production release until exact target ref verified, backup restore rehearsed, v3 verified on isolated DB, CI TypeScript/build green, RLS multi-account tests (couple/family/group, guardian, proof privacy), 18+12 earning and idempotency tests passed, and real pre/post performance metrics recorded.

**Do not apply prior two proposals plus canonical v3 SQL.** Use only the reviewed and drift-adjusted canonical migration when authorized.
