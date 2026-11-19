# Stamp Book First — Release Checklist and Verification

**Status:** Feature branch; draft changes. No Supabase migration, Vercel Preview, Production deploy, or merge authorized.

## Order
1. Verify linked Supabase project ref = \`gczribbtkfvhpzzupqre\`; never use AirQuality. Inspect exact v3 objects, RLS, function grants. Supabase account currently not accessible from this conversation.
2. Back up the complete working database and verify a restore in isolated PointPlus test environment, including Auth and Storage.
3. Apply \`01_stamp_books_proposal.sql\` only to the isolated clone; run \`03_verify_readonly.sql\`. Inspect and fix actual live constraint drift before considering production.
4. Test with 2 or more independent Auth sessions (including child/guardian): create books, choose cross-collection styles, stamp direct and by second-party review, repeated and 1-time books, all 18 designs, claim one of N rewards, stock exhaustion, cancellation, fulfillment.
5. Concurrency: duplicate stamp idempotency key, double approve, concurrent last slot, duplicate claim, same-cycle different reward, no negative stock. Assert new wallet never reads/mutates old point ledger.
6. Once new schema+UI are deployed together as an authorized coordinated release, *and only then* apply \`02_retire_legacy_rpc_proposal.sql\` after snapshotting original function ACLs and trigger state. Otherwise the older production app stops working.
7. Track real latency, mobile accessibility, and confirm CI TypeScript/build green. Final deployment and merge only with explicit approval.

## Pending issues
- Migration is a proposal, not applied. Native Supabase schema tests cannot be asserted PASS.
- Feature cutover needs a deployment order that prevents temporary old/new incompatibility; consider maintenance/feature flag for production.
- Stamp Book Pages redirect legacy user-facing routes but historical SQL/functions are preserved for read-only audit; they must be de-authorized at cutover.
- Existing House/Family Room/Invitations and auth remain unchanged.
- New stamp book claims do not deduct Points; existing points and redemptions remain historical records.
