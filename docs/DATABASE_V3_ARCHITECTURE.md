# Point+ Database v3 — Room-First & Official Collections
**Status:** design and *migration proposal*, NOT applied to any database.
**Supabase target:** `gczribbtkfvhpzzupqre` (verify independently in connector/dashboard before any SQL execution).
**Source baseline:** PointPlus Database v2.0 SQL, plus `main` after PR #10 (merged 2026-11-19).
**Do not create another Supabase project or rebuild Auth.**

## Decisions and invariants

1. **Room** is the user-facing name for the existing `public.spaces` table; do not rename it, its keys or foreign keys.
2. `spaces.kind`: `personal` remains private legacy/default space, and shared rooms are `couple`, `family`, `group`. All accounts may belong to several shared rooms.
3. `space_members` and `participants` distinguish accounts from reward recipients. Family children are `participants.kind='child'`, **not** Auth users; guardians act on their behalf through existing RPCs.
4. Money, commerce, merchants, marketplaces, cash equivalents, sponsorships and loyalty programs are out of scope. All rewards and points are private P2P.
5. All Points, Stamps and Badges are bound to **one space + one participant**. UI can show shared room totals, but never mix or transfer participant wallets.
6. `mission_submissions` (approved and idempotent) is the single event authorizing points/stamps. Use existing `pointplus_review_mission`, `post_points` and `award_stamps` pathways; no writable duplicate ledger.
7. Badges are permanent historical records. An updated criterion applies to future events, not destructive back-processing or deletion of earned badges.
8. Official asset IDs in GitHub are immutable; **database UUIDs are not asset IDs**. All official rows map using `image_key` and badge `slug`.
9. Sensitive mission evidence remains in private `pointplus-evidence` Storage; no public URLs for children or private proofs.
10. Existing v2 rows and identifiers must be preserved. All schema additions are additive or strictly verified constraint extensions; unsupported live schema means stop.

## Data model: base v2, not recreated

| Domain | Existing authoritative tables | Core relation & integrity |
| --- | --- | --- |
| Identity | `profiles` | `profiles.id = auth.users.id`; user locale/timezone |
| Rooms R01/R02 | `spaces`, `space_members`, `participants`, `child_profiles`, `space_invites` | `space_members(space_id,user_id)` PK, role owner/admin/member; child guardian; hashed invite token, 2-person couple limit in accept RPC |
| Activities R03/R05 | `campaigns`, `missions`, `mission_assignments`, `mission_submissions` | `missions.space_id`, `mission_submissions(space_id,participant_id)`, status submitted/approved/rejected; occurrence and idempotency unique |
| Points R06/R07 | `point_wallets`, `point_transactions` | wallet scoped to participant and room; unique ledger source (participant, source_type, source_id); no negative balance |
| Stamps R06 | `stamp_cards`, `stamp_cycles`, `stamp_awards` | card per room, one cycle per participant/card/number, each award tied to approved mission submission |
| Badges R06 | `badge_definitions`, `participant_badges` | rules per room or legacy global; unique (participant,badge); permanent unlock |
| Rewards R07 | `rewards`, `redemptions`, `stamp_prizes` | redeem and refund via existing private point-ledger RPC; issuer/participant/room scoped |
| Notifications & audit R04/R08 | `notifications`, `audit_events` | per user and room; non-exported private proof events |

**New in v3:** `public.room_preferences` (per-account last visited shared room, optional); `pointplus_private.official_assets` (30 versioned rules/catalog entries NOT exposed through the Data API). These are *not* parallel room, wallet or mission tables.

## Room type mapping

| UI type | `spaces.kind` | Official assets `mode` | Participation |
| --- | --- | --- | --- |
| Couple | `couple` | `couple` | 2 adult accounts maximum; check in invite-accept RPC |
| Family | `family` | `family` | Guardians/adults and child participants |
| General/Friends | `group` | `personal` | Multiple authorized adult accounts; earned progress per participant |
| Legacy private | `personal` | `personal` | Auto-created by v2 signup trigger; hidden from shared-room launcher, never deleted |

## Official collection contract — 30 original assets

- Source artwork: `assets/point-plus/manifest/stamps.json` (18), `badges.json` (12), and original SVG/PNG files. Do not change paths, IDs, artwork or translations.
- Source earning rules: `earning-rules.v1.json` (versioned), `features/missions/templates.v1.ts` (18 activity templates).
- `pointplus_private.official_assets` maintains immutable `asset_id`, `mode`, `kind`, rule version, threshold and required stamp ID; this is a **private DB catalog**, not a client-visible authoritative wallet.
- Each room receives **6 official `stamp_cards` and 4 official `badge_definitions`**. Existing default 5/10 stamp cards and legacy badge definitions remain.
- Stamp award: mission with correct `stamp_card_id` is submitted and approved; original `award_stamps` creates `stamp_awards` + updates cycle. Display earned state only from DB.
- Badge criteria: `official_stamps_count` (1/3/5 stamps in a specific category) and `official_categories_count` (one or more earned stamps across **6 distinct official categories**), scoped to participant and room; enforce `status='approved'` when counting awards.
- Asset rarity `bronze,silver,gold,diamond` is visual metadata; legacy database `rarity` is `common,rare,epic,legendary`. Mapping is explicit and tested.
- Immutable earned `participant_badges` historical rows are never deleted by criterion updates or rollback.
- Existing v2 `badge_definitions` can have `space_id IS NULL` (legacy global); official v3 entries **must** have non-null `space_id` and match the room collection.

## R01–R08 access contract

| Mission | DB mechanism | Security/QA acceptance |
| --- | --- | --- |
| R01 Rooms | extend existing CHECK `spaces.kind`; preserve owner/member triggers | only owner creates room; no personal data migration |
| R02 Login/Resume | `room_preferences` or authorized local resume; resolve membership before use | no unauthorized last-room reference or room data fetch |
| R03 Room dashboard | selective index-assisted, LIMITed room-scoped queries | no multi-room query fan-out, measure TTFB & p95 |
| R04 Membership & invitations | existing `pointplus_create_invite`, `pointplus_accept_invite` + RLS | couple max 2; used/expired tokens rejected; guardian scope |
| R05 Missions | existing submit/review RPC + proof bucket | no self-approval in shared adult room; status and occurrence idempotency |
| R06 Collection | official private catalog, `stamp_cards.image_key`, `badge_definitions.image_key`, evaluator | exactly 18/12; every stamp earnable and badge unlockable; no duplicate grants |
| R07 Rewards | existing redemption, fulfill, cancel RPC and wallet ledger | no negative wallet; double-click/replay safe; room scoped |
| R08 Release | policies, security-definer review, backups and read-only audits | live isolated DB + multi-account E2E + measured perf; zero unauthorized cross-room visibility |

## Security model & performance

- All `public` tables must have RLS enabled and explicit grants. `room_preferences` is user-only, authenticated SELECT/INSERT/UPDATE. Private catalog is in unexposed `pointplus_private` with SELECT/EXECUTE revoked from `anon`/`authenticated`.
- Keep security-definer functions in `pointplus_private`, `SET search_path=''` with fully-qualified table/function names; explicit GRANT only as necessary and no direct client access to `post_points` or `award_stamps`.
- Never trust submitted `space_id`, `participant_id`, `image_key`, `role` or a Room switcher solely on the frontend. Authorized server session + membership checks are always necessary.
- Recheck Data API exposure after migration: granting a table is distinct from its RLS policy.
- Index candidates: `missions(space_id,status,created_at)` and `mission_submissions(space_id,status,submitted_at)` already exist in v2; v3 adds unique official `stamp_cards(space_id,image_key)` and lookup index on `badge_definitions(space_id,image_key)` only after duplicate preflight.
- No fabricated latency claims. Measure representative 0/1/5/20 room accounts and 100+ mission fixtures on a safe isolated environment.

## Delivery / rollout

`supabase/v3/01_audit_readonly.sql` -> `02_upgrade_proposal.sql` -> `03_verify_readonly.sql` -> `04_safe_rollback.sql`.

**All files are proposals, not approved/applied live migrations.** Run migration first on an isolated clone, after verifying ref and a tested full backup. Supabase CLI v3 database commands default to local; use the documented `--remote` and explicit target binding in a separate, audited deployment plan. Do not push/merge/deploy automatically.

Previous `supabase/proposals/room_first_group_kind.sql` and `room_first_official_catalog_v1.sql` are **superseded** by this canonical v3 package. Do **not** apply both sets.

See `docs/DATABASE_V3_DIFF_AND_ROLLBACK.md` for v2 comparison and practical rollback policy.
