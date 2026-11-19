# PointPlus Phase 1 — M08–M10 Handoff

PointPlus remains strictly non-commercial and P2P. M08–M10 implement the Phase 1 mission-configuration workflow. They DO NOT implement mission submissions, approvals, points minting, stamp awards, merchant rewards, payments or marketplace features.

## M08 — Complete Mission Creator

The M08 UI and server action create v2.0 missions in the actual Supabase missions table, using owner/manager authorization from verified Space membership. The form covers title (1–160), description, all four frequencies (once/daily/weekly/repeatable), open/assigned, points (0–1,000,000), stamps (0–100) with valid stamp card, campaign, completion cap, Space-local start/end, and draft/active status. Approval verification mode is fixed. Space identity and created_by are always derived server-side. DB RLS is the final permission gate.

Dates are converted from Space-local wall time to UTC, with invalid and ambiguous DST dates rejected rather than silently shifted.

## M09 — Mission Management, Assignments & Campaigns

Manager-only pages edit missions without replacing IDs. Status transitions are draft -> active (with explicit confirmation, valid catalog, nonexpired window, and at least one assignment for assigned mode), or active -> archived (confirmation, preserve all history). Assignment insert and delete check same Space and verified participant; the database enforces composite foreign keys and RLS. Creation and editing of campaigns use actual v2.0 campaigns columns and timezone validation. Archived missions are read-only; no hard deletes.

## M10 — Dashboard & QA

Real Space summary loads accessible Spaces, member counts, visible participants, active/assigned mission counts, current window counts, and selected participant point wallet balance when available. A missing wallet displays a dash, not an invented zero. All links point to implemented pages. Form fields are labeled, feedback states and confirmations exist, and responsive cards/layouts adapt to small screens.

### Automated tests

CI runs npm ci, original asset validation, M01 tests, M02–M07 tests, M08–M10 tests, Next.js production build, and TypeScript typecheck. The new tests run the actual mission validation and timezone conversion code. Source-contract checks are supplementary and DO NOT replace live E2E authorization tests.

### Live acceptance scenarios from the master prompt — NOT TESTED

1. Register new account.
2. Open automatically provisioned Personal Space.
3. Update profile.
4. Create Couple Space.
5. Create and accept invite with second account.
6. Create Family Space.
7. Create child participant.
8. Create all four mission frequencies.
9. Assign a mission to a valid participant; reject out-of-Space ID.
10. Edit and archive mission, preserving prior submissions.
11. Verify ordinary members cannot manage missions.
12. Verify unrelated Spaces cannot read or change each other's data.

All 12 require access to the PointPlus Supabase project, at least two controlled test accounts, working Auth/email settings, and a safe test environment/browser. **They are not being claimed as passed.** The connected Supabase account has only the unrelated AirQuality project, not target gczribbtkfvhpzzupqre; no database writes were attempted.

### Remaining QA / risks

- Verify exact installed RLS, 22 tables, nine RPCs, signup triggers, and Session behavior using an authorized PointPlus project connection.
- Generate Supabase TypeScript types from the actual database; DTO types in the app are source-SQL-derived, not generated.
- Browser/manual mobile, keyboard, screen reader and multi-user security QA remain outstanding.
- Supabase API row limits can cap dashboard/mission counts; pagination or count queries are needed for large Spaces.
- Verify concurrent edits and assignment changes, archived mission interactions and behavior with historical submissions against real DB rows.
- Set canonical NEXT_PUBLIC_SITE_URL and Supabase Auth redirect allowlist for each target deployment.
- Merge stacked PRs in order: #3 (M01), #4 (M02–M07), then M08–M10. No auto-merge.

**Final acceptance: PARTIAL until integration scenarios and live RLS pass.**
