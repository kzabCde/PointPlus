# Point+ Database v3 — Operator Runbook (NOT EXECUTED)

## Current state as of 2026-11-20

- Proposed SQL and docs committed to `feat/database-v3-room-first-schema`.
- PR #10 merged the Room-First application code into `main` **before** this v3 work. This proposal is separate.
- Target Supabase ref: `gczribbtkfvhpzzupqre`.
- Connected Supabase tool currently responds `link_id must identify an eligible linked account`. Do not guess a project or reuse credentials for AirQuality.
- No SQL changes, live E2E tests, production merges or Vercel deployments have been performed as part of v3 work.
- Previous `supabase/proposals/room_first_group_kind.sql` and `room_first_official_catalog_v1.sql` are *obsolete alternatives* that must **not** be applied in addition to the canonical v3 SQL.

## Files and order

| Order | File | Purpose |
| --- | --- | --- |
| A | `01_audit_readonly.sql` | Inventory live tables, constraints, RLS, triggers and aggregate data; capture v2 function definitions |
| B | `02_upgrade_proposal.sql` | One atomic, guarded v2->v3 transaction; six stamps/four badges seeded per Room; new preferences and private catalog |
| C | `03_verify_readonly.sql` | Validate 30 assets, exact room mappings, cross-Room award mismatch=0, rule version, wallet ledger and RLS |
| D (if needed) | `04_safe_rollback.sql` | Disable future official seeding and deactivate official catalog entries; keep all rows and original tokens/IDs/points |

These files are **proposals**. `02_upgrade_proposal.sql` is not yet a versioned Supabase `supabase/migrations` entry. Once a correct, isolated environment is available, use `supabase migration new pointplus_database_v3_room_first` in that working copy, review the generated name, copy the audited SQL into it and follow the Supabase CLI version's documented migration workflow. Do not invent a timestamp filename or run remote push from this chat.

## Preflight (all mandatory)

1. Refresh Supabase OAuth connection. Confirm connected project metadata ref EXACTLY `gczribbtkfvhpzzupqre`, independent of SQL.
2. Confirm actual schema is **unmodified v2**. If one of the two earlier SQL proposals has been executed, STOP and rewrite migration as a new live-schema diff, without duplicate DDL.
3. Capture secure prechange audit from `01_audit_readonly.sql`, especially `pg_get_functiondef(evaluate_badges)`, actual RLS policies and constraint names.
4. Take complete restorable backup and **test restore** on an isolated nonproduction PointPlus database, including Auth and Storage dependencies.
5. Review index-lock duration and storage capacity; migration sets `lock_timeout=8s` and `statement_timeout=120s` per statement, not a guarantee of runtime or absence of lock contention.
6. Run upgrade proposal only on that isolated clone first. Verify `03_verify_readonly.sql`, then run multi-account and idempotency E2E.
7. Obtain explicit human signoff before touching production. The GitHub `main` branch, Vercel and actual Supabase project remain unchanged here.

## Supabase CLI v3 caution

Since Nov 2026, Supabase CLI v3 uses **local database by default**, and hosted operations require explicit remote targeting and approval. Always check `supabase --version`, command-specific `--help`, active project ref, backup status, and prompt confirmations before operations. No unattended migrations on production.

## E2E acceptance and rollback

- 3 Room types and legacy Personal Space retained; two-adult Couple limit, Family guardian/child, Group member isolation.
- Existing mission and points history consistent; verified authorized stamps 18/18 and badges 12/12; wallet balance and zero duplicate award on replay.
- Three or more independent users tested across separate Rooms; private evidence RLS and child proof access denied for strangers.
- Real TTFB/query counts/median and p95 measured before and after against same dataset.
- If tests fail while migration transaction is open, rollback is automatic. If problems appear **after commit**, pause v3 operations and apply `04_safe_rollback.sql` as a **data-preserving feature freeze**; use captured function source/backup for a reviewed corrective migration. Do not run blind DROP/DELETE of Room, child, wallet, award or points data.
- Production activation only after complete approvals and planned single deployment, not Vercel Preview.
