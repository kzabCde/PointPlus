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

## v1.2: free-text reward request & memory archive

Once the recipient has collected all target stamps in their Couple Book, they enter a free-text reward message (1–1000 characters) and submit it. The **recipient**, not the creator, invokes the claim. This atomically creates a pending reward claim and sets that book to `archived`. The creator can then mark delivery fulfilled or canceled. The message, the completed stamp pages, giver notes, timestamps and claim history remain readable to both members. Archive does not delete anything.

The v1.2 migration `08_couple_memory_redemption.sql` disables automatic repeat cycles for future Couple books and blocks old fixed-option rewards specifically on Couple Books (other Room types are unchanged). It uses an FK-compatible reward option row for each free-text claim and preserves the full text in `stamp_book_claims.reward_title_snapshot`. The book remains archived even while the physical reward is pending delivery. The old `stamp_book_claims` uniqueness constraint prevents multiple claims per completed cycle. A repeat of the **identical** request key and text returns the original claim; different attempts fail.

The optional feature-pause SQL is `09_couple_memory_redemption_rollback.sql`. It revokes new redemption access but **never reopens previously archived books or deletes memories**. Always prefer a corrective forward migration where possible.

Live database target: `gczribbtkfvhpzzupqre`. Do not merge or deploy frontend from PR #15 until CI and two-user browser E2E pass.
