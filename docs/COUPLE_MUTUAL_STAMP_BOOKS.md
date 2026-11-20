# PointPlus — Mutual Couple Stamp Books (v1.1)

**Database target:** `gczribbtkfvhpzzupqre`  
**Migration:** `supabase/stamp-book-first/06_couple_mutual_books.sql`  
**Rollback script:** `supabase/stamp-book-first/07_couple_mutual_books_rollback.sql`

## Product model

A Couple Room contains two members. Both have equal ability to create independent Stamp Books, regardless of their Room role (`owner` or `member`). In each new Couple Book:

- The **creator** is always authorized to give stamps to the **other partner**.
- The **recipient** is exactly the other active adult participant, never the creator.
- Stamps are **direct**; they do not require a reviewer in a two-person Couple Room. Existing non-Couple approval workflows are unchanged.
- The recipient may redeem one configured reward after completing each cycle, without any Point wallet deduction. The creator may mark that claim fulfilled or canceled. A completed cycle is claimable even if a new repeatable cycle already started.
- Both Room members can view the other partner's Stamp Books, progress, marks, and reward claims, but **outside users cannot**.
- Only the creator can change their Couple Book settings, add its reward choices, or process its claims. Neither a Partner's Room `owner` title nor Room `member` title grants control of the other's book.
- Existing data (Rooms, identities, prior Stamp Books, Marks, Claims, Wallets, Point Transactions, Missions) remains intact.

## Live database status

The v1 base migration `20261120032841_pointplus_stamp_book_first_schema_v1` was installed previously. The v1.1 migration was applied via authenticated PointPlus Supabase connection and tested. It replaces five existing RPC definitions, adds a private editor authorization helper and additive Couple-only SELECT policies on five ledger tables. No historical row updates, deletes, or table rebuilds are required.

A real two-member Couple Room was used for **BEGIN / ROLLBACK** role-context SQL tests:

1. Member creates a new direct book for Owner → stamps → cycle completed and repeatable cycle created → Owner reads progress and claims the reward → Member fulfills.
2. Owner creates a new book for Member → stamps → cycle completed → Member reads progress and claims → Owner fulfills.
3. Unrelated authenticated identity cannot read either couple book or its progress.
4. Old `point_transactions` count remains unchanged.

All synthetic book, award and claim rows were rolled back. No new test book, mark, cycle, reward or claim is retained.

## Release and security

The Next.js UI and Server Action updates live on a feature branch, not `main`, until approved for merge. Run existing GitHub Actions contract tests, TypeScript typecheck and build before release. Browser-based test with two distinct real sessions is still required, as is restored-backup testing and a full rollout review. Do not deploy a preview or production environment from this change in isolation.

**Rollback caution:** restoring the prior creator/manager authorization rules would remove create/edit/give rights for non-manager Couple members, including already-created books; the underlying books and awards would remain intact. Prefer a reviewed forward fix for issues affecting historical couple books.
