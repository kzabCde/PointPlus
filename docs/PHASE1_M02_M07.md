# PointPlus Phase 1 — M02–M07 Handoff

## Status
**Code implemented and GitHub CI passed; live integration PARTIAL/BLOCKED.** The linked Supabase account is **not authorized** for PointPlus project `gczribbtkfvhpzzupqre`. The only connected project belongs to a separate app; it has not been queried or modified.

## Mission implementations
- **M02 Auth:** `features/auth` and `app/(auth)` (signup, signin, signout, email confirmation callback, forgot/recover password). The server verifies users, protected routes redirect to login, and redirect targets are whitelisted.
- **M03 Onboarding/Profile:** `features/profiles`, `/onboarding`, `/profile`; read actual signup-trigger records, edit display name, locale and timezone without creating duplicate records.
- **M04 Spaces:** `features/spaces`, `/spaces`, `/s/[spaceId]` and settings; create Couple/Family and use DB triggers, verify membership server-side and owner edits.
- **M05 Invite/Membership:** `features/invitations`, `/join`, `/s/[spaceId]/members`; exact v2 RPC names, role expiry validation and one-use tokens. Tokens are carried in fragment so the initial GET does not expose them. Anonymous invitees must sign in and reopen the original invitation URL, not copy a token into a login URL.
- **M06 Children:** `features/participants`, Family children screen; real RPC and RLS-backed read for guardians and managers; no child authentication account.
- **M07 Mission Board:** `features/missions`, Space mission list/detail; real Supabase reads for missions, assignments, campaigns, stamp cards and participants. Filters enforce active/draft/archived visibility and assigned-person restrictions, with no fake submission or points.

## Environment / deployment
1. In Vercel set `NEXT_PUBLIC_SUPABASE_URL` to the target PointPlus project and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that same project's publishable key. The existing `.env.example` contains publishable examples only.
2. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin (do **not** leave `http://localhost:3000` in production).
3. In PointPlus Supabase Dashboard > Authentication > URL Configuration, set the matching Site URL and allow `https://YOUR-DOMAIN/auth/callback` and all intended preview callback URLs. Also allow `http://localhost:3000/auth/callback` for local tests.
4. Verify Email provider and SMTP settings / confirmation policy. Password recovery and confirmation link delivery cannot be validated until working Auth and mail configuration exist.
5. Verify all 22 public tables, nine RPCs, RLS and the signup/provisioning triggers exist as in `pointplus_database_v2.sql`.
6. Never copy secrets/service-role keys to `NEXT_PUBLIC_` or run migrations against another project.

## Automated verification
```bash
npm ci
node scripts/validate-point-plus-assets.mjs
npm run test:foundation
node --test tests/phase1-m02-m07.test.mjs
npm run typecheck
npm run build
```
The checked-in tests are **automated source-contract checks plus a redirect runtime unit check**, not live Supabase E2E tests.

## Required live acceptance tests (NOT TESTED)
- M02: registration with and without email confirmation, sign-in/out, password reset and refresh/expired session behavior.
- M03: first user bootstrap (exactly one Personal Space, adult participant, wallet), profile persistence and missing trigger scenario.
- M04: create Couple and Family, switch, owner edit, unauthorized edit, unrelated-Space access blocked.
- M05: member/admin invite restrictions, one-use expiry/reuse, join after login, Couple max 2 adults, anonymous invite handling, token non-disclosure.
- M06: guardian child creation, RLS visibility, unauthorized child read blocked, child rows and wallets provisioned once.
- M07: seeded active/draft/archived missions, assignment filtering, unassigned member denied detail, participant filter tampering, timezone date windows, mobile/UI accessibility.

## Known limits
- Database TypeScript codegen is deferred until a valid live PointPlus database connection is available. DTOs are derived only from the reviewed original SQL v2.0 contract.
- Supabase REST usually caps query row counts. Audit pagination or server-side filtering before very large Space mission catalogs.
- Locale selection is persisted; complete UI English translation is not in M02–M07 scope.
- No email, browser E2E, multi-user authorization, device or live DB checks have passed.
- M08–M10, including mission creation/editing, submission/review, point awards, stamps/badges and redemptions, are not implemented.

## Version control
Branch `feat/phase1-m02-m07` stacks on `feat/phase1-m01-foundation` (PR #3). PR #4 should be reviewed after M01 merges or rebased on `main`. Neither PR is automatically merged.
