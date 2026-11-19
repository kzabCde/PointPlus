# PointPlus — Phase 2 security and release-verification handoff

Date: 2026-11-19. Target repository: `kzabCde/PointPlus`, draft PR #8. Product is non-commercial private P2P; no money, merchants, or transfer of points.

## Evidence and limitations

Source reviewed: existing repository and the provided PointPlus Database v2.0 SQL file. **The live PointPlus Supabase project (`gczribbtkfvhpzzupqre`) is not accessible through the connected Supabase integration.** Therefore statements about actual live RLS behavior or deployed triggers must remain **UNVERIFIED**. No schema changes are authorized or applied.

The CI workflow runs against `.env.example` and is a static/build/test check, **not** authenticated live-database testing. A successful CI build must never be interpreted as passing the full acceptance criteria.

## Implemented safeguards

| Area | Current implementation | Source authority |
|---|---|---|
| Authentication | Authenticated server context using Supabase SSR `getUser()` and membership checks | `features/spaces/data.ts`, `lib/auth/session.ts` |
| Submissions | Caller-scoped participant checks, evidence owner-path check, stable request idempotency key | `features/social/actions.ts` |
| Mission completion | Only `public.pointplus_submit_mission` writes submissions; no frontend point minting | Database v2 SQL |
| Review | Membership and adult/child review eligibility checked server-side; review RPC independently verifies and serializes with row lock | `features/social/actions.ts`, Database v2 |
| Points | Reads wallet/transactions only; no direct client writes | `features/social/data.ts`, Database v2 |
| Evidence | Private 5-MB bucket; random caller-prefixed upload paths; signed URL created server-side | `features/social/submission-form.tsx`, Database v2 policy |
| Notifications | Recipient-based read/write; `read_at` updated for caller's own record only | `features/social/actions.ts`, Database v2 |
| Realtime | Client gets deliberate refresh and visible-tab polling; no unverified private Realtime subscriptions | `features/social/refresh-control.tsx` |

## Findings to investigate in live database

**SEC-01 (potential privacy issue; needs product decision):** SQL v2 `missions_read` grants `SELECT` on all missions in a Space to any authenticated Space member. Phase 1 UI hides assigned missions from unassigned participants, but REST clients could still query mission title/description. If assignments must be private, **RLS must restrict the mission rows**. Do not rely on UI filtering.

**SEC-02 (authorized reviewer breadth):** SQL v2 permits another adult Space member to review a submitted adult participant mission, not just owner/admin. This is a deliberate behavior of `review_mission`. All adults in that Space (other than the original submitter) may be legitimate reviewers. Verify with the product owner before narrowing this rule, as changing it would break existing intended flows.

**SEC-03 (relationship safety gaps):** SQL v2 does not provide a verified way to leave a shared Space, remove members, block interactions or report abuse. These are separate user safety features requiring an approved schema/API design and RLS tests. Do not add unsafe direct `DELETE` grants.

**SEC-04 (missing event):** The SQL v2 submission and review RPCs create notifications, but mission assignment changes do not emit a dedicated `mission.assigned` notification. A database trigger/RPC addition may be required. Do not send duplicate browser-side notifications.

**SEC-05 (evidence metadata):** SQL v2 validates caller prefix on `p_proof_path` but does not, in the reviewed function, explicitly verify the existence of the referenced object. The UI uploads before submission; direct RPC callers could provide a nonexistent same-user path. If mandatory proofs are supported in future, validate object existence and mission-specific evidence requirements server-side.

**SEC-06 (pagination/counters):** Mission detail shows the latest 100 submissions; Daily Moments reads up to 500 recent submission rows. Supabase enforces authoritative limits, but UI hints can become stale or incomplete on long-lived repeatable missions. Scale testing and server-side count/period filters are needed for production.

**SEC-07 (potential visibility mismatch):** SQL v2 `submissions_read` grants any Space member access to another adult's mission submissions, including proof text and review notes. This follows the broad reviewer permission but may not meet a stricter privacy model. Revisit alongside SEC-01/SEC-02.

## Database checks (read-only, run only after verifying target project in Supabase Dashboard)

```sql
-- Confirm public table RLS status; must be TRUE on every exposed PointPlus table.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('profiles','spaces','space_members','participants','child_profiles',
    'missions','mission_assignments','mission_submissions','point_wallets','point_transactions',
    'notifications','audit_events','rewards','stamp_cards')
ORDER BY c.relname;

-- Read exact public RPC signatures, security mode and grants before using live features.
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('pointplus_submit_mission','pointplus_review_mission')
ORDER BY p.proname;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('missions','mission_assignments','mission_submissions',
    'point_wallets','point_transactions','notifications')
ORDER BY tablename,policyname;

SELECT id,public,file_size_limit,allowed_mime_types
FROM storage.buckets WHERE id='pointplus-evidence';

SELECT schemaname,tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename IN
  ('mission_submissions','point_wallets','point_transactions','notifications');
```

### Proposed changes only — NOT applied

1. If assignment titles are private, replace the broad `missions_read` RLS policy with `owner/admin OR (open and member) OR (assigned to caller/authorized guardian)` and test across all existing UI paths. Introduce indexes as needed; use the verified definition of `pointplus_private.can_act_for` and validate policy recursion.
2. Add the minimal safe `mission.assigned` notification source under an approved DB migration, with recipient-scoped payload and no duplicate event on retries. Do not mint points or bypass reviews.
3. Design revocation, member departure, child guardian and block/report semantics as independent privacy changes; do not run destructive membership mutations without requirements and role-based tests.

## Required live E2E test matrix

Use at least two adult Auth users, separate Spaces, one guardian and a child participant. For every case, record actor, Space, participant, expected SQL error/visible rows, actual result and transaction/balance after operation.

| Scenario | Required outcome |
|---|---|
| Unassigned adult submits assigned mission | Denied by RPC |
| Account A substitutes account B participant ID | Denied |
| Same idempotency key retried after a success | Same submission UUID; one award |
| Same daily/weekly occurrence submitted twice | Denied by DB unique rule |
| Personal Space submits valid mission | Auto-approved (v2 path), exactly one points entry |
| Another adult reviews pending adult mission | As allowed by v2 reviewer rule |
| Submitter tries reviewing own shared adult submission | Denied |
| Guardian reviews own child submission | As authorized by v2 |
| Unauthorized reviewer attempts child approval | Denied |
| Two reviewers approve simultaneously | Exactly one approval and one ledger entry |
| Cross-Space user reads evidence/child profile/notifications | Denied |
| Remove member / revoke invite while active | Product behavior requires approved capability design |
| Realtime disconnected / reconnected | Views remain functional via refresh fallback |
| Timezone midnight boundary | New daily occurrence only when Space-local date changes |
| Mobile viewport and keyboard navigation | Controls visible, tappable, usable |

## Deployment policy

Vercel project `nowheredev/pointplus` has Preview Deployments disabled by the user's request. Keep PR #8 in Draft and unmerged. GitHub CI is allowed; **no Preview or Production deployment**, no automatic main merge, and no database schema application until Phase 2 is accepted and release is explicitly approved.
