# Remove obsolete timezone storage — safe rollout

Project: `gczribbtkfvhpzzupqre` (Que168). Updated 2026-11-20.

## Current live status

The current web UI already does **not** ask for a timezone at sign-up, onboarding or Room creation. However, the live Supabase database still has two `NOT NULL DEFAULT 'Asia/Bangkok'` columns: `public.profiles.timezone` and `public.spaces.timezone`. Before this PR the data loaders still selected both columns, and the retired private mission issuance function referred to `v_space.timezone`.

## Changes in this branch

- `features/profiles/data.ts` and `features/spaces/data.ts`: remove timezone from TypeScript models and SELECT projections.
- `lib/auth/validation.ts`: remove unused timezone validator.
- Regression test that these files no longer refer to timezone.
- `10_remove_unused_timezone_after_deploy.sql`: guard DB schema, preserve historical function's Bangkok bucketing without a Room timezone column, and DROP two unused columns.
- `11_restore_timezone_columns_if_rollback.sql`: restore compatible column shapes with default Bangkok (does not recreate previous per-row values).

## Critical rollout order

1. Verify application CI and review the actual deployment target; **merge and deploy new code before applying the DROP COLUMN migration**. Do not run the migration while an existing Vercel deployment queries the old columns.
2. Verify active Room and Profile reads from the updated deployed build.
3. Take a restorable backup / snapshot of PointPlus before the DDL. Protect historical data.
4. Apply `10_remove_unused_timezone_after_deploy.sql` to the exact linked PointPlus project only, check SQL migration history, RLS, and read/write smoke tests.
5. If old app builds must return, use `11_restore_timezone_columns_if_rollback.sql` *before* rolling back the app. Row-specific timezone values are not recoverable without backup; defaults will be `Asia/Bangkok`.

`10` passed a transactional `BEGIN ... ROLLBACK` database preflight. **It has not been applied to live Supabase.** Existing 2 profiles and 3 Rooms are intact. Do not deploy or merge this branch automatically as part of the database cleanup.
