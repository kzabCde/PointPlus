# Point+ — Living Stampbook V3 only: legacy retirement

## Production status (21 Nov 2026)

**Already applied on Production Supabase project `gczribbtkfvhpzzupqre`:**

`supabase/stamp-book-first/21_retire_legacy_collections_data.sql` — recorded in migration history as `pointplus_retire_legacy_stamp_collections_data_v1`.

Executed inside a transaction after successfully running the exact migration with a terminal `ROLLBACK` on Production. The transaction aborts when historical counts/dependencies differ from the audited snapshot.

| Database records | Before | After |
|---|---:|---:|
| `stamp_books` | 2 | 0 |
| `stamp_book_marks` | 4 | 0 |
| `stamp_book_stamp_requests` | 4 | 0 |
| `stamp_book_cycles` | 2 | 0 |
| `stamp_book_styles` | 36 | 0 |
| `stamp_book_reward_options` | 2 | 0 |
| `stamp_cards` | 4 | 0 |
| `stamp_cycles` | 0 | 0 |
| `stamp_awards` / `stamp_prizes` | 0 | 0 |
| `stamp_book_artworks` (**shared with Living**) | 18 | **18** |
| `auth.users` | 3 | **3** |
| `spaces` | 2 | **2** |
| `space_members` | 3 | **3** |
| `living_books` | 0 | **0** |

Other old `stamp_book_*` records (claims, recipients, givers) were also cleared. No Living Stampbook records were deleted.

**Legacy creation/issuance RPCs revoked from anon/authenticated**. New spaces no longer receive automatically created Stamp Cards; their membership creation and badge-seeding trigger remain functional. The obsolete mission-card award procedure now does nothing, preventing spontaneous regeneration. Existing new `pointplus_*living*` functions remain intact.

### UI and code

Draft PR [#29](https://github.com/kzabCde/PointPlus/pull/29), branch `feat/living-only-retirement`:

- Replaces the room home and collection shelf with **Living Stampbook V3 only**.
- Replaces create-new card-vs-book selection with Living Book creation.
- Removes obsolete Stamp Book detail/edit routes and all retired `features/stamp-books/*` modules.
- Retains `features/living-books/*`, new photo assets, redemption, page editor, stamp ledger, and 18 shared artwork assets.
- Removes the unused legacy paper and journal CSS.
- Updates tests and CI for V3-only creation while preserving all M01–M05 PostgreSQL integration and security tests.
- Existing historical migration source files 01–20 remain in the repository for audit and reproducibility. Historical SQL does **not** run automatically.

### Pending post-deployment schema cleanup

`supabase/stamp-book-first/22_post_cutover_drop_legacy_schema.sql` is **staged only; DO NOT APPLY YET**.

Production currently serves `main` at the merged PR #28 commit and still has old code that queries the legacy tables. Dropping those tables now would cause production server exceptions. Run the schema-removal migration **only after**:

1. Merge PR #29 and verify Vercel Production deployed a successful Living-only build.
2. Verify creating a Room still provisions the owner/membership and no cards, adding a new Living Book works, giving/peeling/claiming/redeeming work with two real users.
3. Confirm no old system references are left in live routes, mission RPC code or SQL dependencies. The legacy mission subsystem still references `stamp_cards` and must be decoupled before schema drop.
4. Verify database backup/PITR restore points and run a schema-drop rehearsal on a disposable restored database. No verified database backup is currently available through the connected tools.
5. Run `22_post_cutover_drop_legacy_schema.sql` as a single transaction. **NEVER use CASCADE blindly**. Stop on FK or function dependencies.
6. Verify all 18 artwork rows and all Living tables/RPC/RLS still exist; run Supabase Security and Performance Advisors.

**Not authorized by this PR:** changing or dropping member/profile/room data, deleting shared art, removing the unrelated mission or badge system, automatically merging PR #29, or deploying a Preview/Production build without a separate release decision.

## Important limitations

- The live Production SQL 21 already permanently deleted the legacy history. A verified point-in-time backup was not available through the connector; there is no guaranteed rollback of these individual records.
- SQL 22 is not yet executed; legacy schema persists temporarily for currently deployed code compatibility.
- Current Production website will still show its old interface until PR #29 is deployed; obsolete actions are disabled in the database.
- Full browser two-account E2E is still required before the release can be considered production-verified.
