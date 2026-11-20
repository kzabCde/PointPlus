# Stamp Book First — implementation & SQL migration gate

**Target:** PointPlus Supabase ref \`gczribbtkfvhpzzupqre\`. The Supabase connector currently errors: \`link_id must identify an eligible linked account\`. No live migration was applied. Existing v3 base schema has already been observed in previous audit; NEVER rerun \`supabase/v3/02_upgrade_proposal.sql\`.

## New authoritative workflow
A new \`stamp_books\` data model coexists historically with legacy cards without sharing its active counters or point wallets. \`stamp_book_marks\` is the only new increment source; \`stamp_book_cycles.progress_count\` updates only inside atomic RPC. Each stamp event has immutable selected artwork, giver, recipient, note and request. Per-cycle claim is unique and cannot deduct points. Claims canceled after request are terminal; reserved finite stock is returned once. Repeatable cycles start at completion; old claim can be selected later.

## Permission model
New tables have RLS enabled, SELECT-only grants, and all updates through owner/manager/participant/giver-validated RPCs. Room managers create books and review requests, explicit giver allowlist applies, self-stamping only permitted in Personal Spaces with an opt-in; guardians claim on behalf of children. One-of-N reward claim requires the entitled participant or guardian. The reviewer must differ from the giver.

## Release gate / unresolved
- Confirm the exact live table/column/constraint shapes on \`gczribbtkfvhpzzupqre\` and baseline Auth/Storage settings.
- Review migration transaction on isolated database backup + restore; review security-definer RPC grants and test spoofed book/recipient/style IDs.
- Verify all 18 assets, direct stamping, approval-required stamping, reward stock/concurrent claims and cancellation.
- Remove old flows from app navigation; legacy data retained read-only. Legacy mission/badge auto triggers remain in database for historical records; block old UI/action entry points and add explicit audited DB feature shutdown if still callable by old clients.
- Existing official 18 Stamps/12 Badges artwork and data remain untouched.
- **No production migration, Merge, Preview or Production deploy before signoff**.
