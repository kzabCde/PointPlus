# Point+ Room creation repair — Living V3 card extension

## Confirmed incident causes (2026-11-21)

- Production `main` at `bba0b701` still exposes legacy card creation, while
  `authenticated` cannot execute retired `pointplus_create_paper_stamp_book` and
  `pointplus_create_stamp_book`. The old write paths must stay disabled.
- The Room homepage derived its primary list from `stamp_books`, rather than
  `living_books`, so the existing Living book could be invisible on the Room page.
- Original M01 index `living_books_one_open_direction` disallowed a second active
  book with the same owner and recipient. Its uniqueness must be relaxed if more than
  one independent collection is allowed per Couple direction.
- PR #30 fixed the former non-async Server Action export. PR #31 merged into PR #29's
  integration branch, not `main`; PR #29 was closed without merging.

## Current branch scope

- Room homepage always offers authorized users creation; existing Living books/cards
  and archived history remain available.
- A Living card is an M01 `living_books` row plus a `living_book_cards` config.
  It reuses the M01 create function, initial page and giver permission; the old
  stamp-books / stamp-cards write RPCs are **not** called.
- M03 remains the only authority to issue a real stamp. A database trigger maps exact
  coordinates onto its numbered slot and a partial unique index prevents multiple
  pending/approved stamps in a slot. Peeling does not erase the approval/slot history.
- M04 remains the only authority to request, reserve, fulfill and cancel rewards. A
  card-specific trigger requires the full target and preconfigured reward at request
  time, including available ledger-mark validation.
- Legacy records are retained read-only in the collection shelf for history.

## Deployment order — REQUIRED, never perform automatically

1. Review PR while Draft; run `verify` plus the isolated PostgreSQL card migration job.
2. Run two authenticated-user hosted E2E flows in an **isolated** non-Production
   environment with new V3 migration (A→B, B→A; both book and card).
3. Inspect security grants and migration in detail. Deploy the additive migration
   to the intended environment only as a separately authorized release step,
   immediately ahead of the matching app release.
4. Deploy matching reviewed application build, verify logs and the complete Room
   flow. Do **not** expose the V3 card frontend before its migration.
5. Continue monitoring errors and rollback gates.

## Migration and rollback

- File: `supabase/stamp-book-first/23_living_v3_stamp_cards.sql`.
- This migration removes the restrictive **index only**, not any rows. It adds a
  read-only-to-clients card config table, a slot annotation, guards, and a versioned
  RPC. The M01–M05 functions and stored historical records remain unchanged.
- Data-preserving **application rollback**: revert the V3 card UI route to the
  previous reviewed build, leaving the new DB schema and card rows intact. If an
  operational pause is needed, revoke `EXECUTE` on
  `public.pointplus_create_living_card(uuid,uuid,text,text,text,text,uuid,integer,text)`
  from `authenticated` until fixed; restore only after review.
- The unique direction index can be restored only when there are *zero* duplicate
  active/paused rows per (space_id,owner_user_id,recipient_participant_id). Never
  recreate it blindly once multiple books have been legitimately created.
- Do not DROP `living_book_cards` or its data as part of rollback. A later
  verified archive/decommission plan would be required to remove the extension.

## Required release blockers until verified

- The SQL migration **has not** been applied in Production.
- Browser E2E with **two real authenticated accounts** and a migrated isolated
  environment must pass; source-only tests do not replace this.
- M01–M05 and UX01–UX04 regression tests need to be executed on the final
  integration commit; PR #31's UX code is on a distinct branch and is not
  automatically included in this fix.
- Verify RPC approval-policy flow, idempotency concurrency, fulfilled/canceled reward,
  owner/member authorization and RLS under isolated fixtures and hostile inputs.
- Confirm the feature-specific SQL migration and code are released atomically.
