# Point+ — User-Configurable Stamp Books and Choice Rewards (Product Decision)

**Decision date:** 2026-11-20. **Status:** Approved direction requested by user; implementation design only. This is a material R06/R07 scope change. **No SQL in this document has been executed.**
**Target product:** P2P Room-First Point+; no businesses, cash equivalents, marketplace or commercial loyalty.
**Existing architecture:** Room = `public.spaces`, historical stamps in `stamp_cards/stamp_cycles/stamp_awards`, official 18 stamp artworks and 12 badge artworks, `rewards/redemptions/stamp_prizes` and points wallets.
**Live schema status:** database v3 is reported in `DATABASE_V3_LIVE_AUDIT.md`; recheck actual constraints/columns, functions and RLS before authoring any remote migration.

## New primary experience

A user creates a **Stamp Book** for a Room (or their Personal Space) and defines:

1. **Book details**: name, optional cover, description, who can receive stamps, who may approve/issue, `target_count` (for example 5, 6 or 10), active/archived and repeatable yes/no.
2. **Stamp artwork**: choose allowable designs from the **existing 18 stamp graphics** across all collections; optionally set a default. At **each individual stamp event**, the authorized giver/reviewer chooses **exactly one stamp design**; stamps on the same book can be mixed. A custom book's visual choice is *not* its achievement category.
3. **Earning rule**: an approved shared activity earns **exactly one stamp**, irrespective of image. A manual gift stamp may be requested only with an auditable approval event and the same idempotency/authorization protections as an approved mission; never allow an arbitrary client counter increment.
4. **Reward options**: Book creator or Room manager chooses one or more private, in-Room reward options, e.g. "choose tonight's movie", "homemade breakfast", "plan the weekend". There is **no requirement to spend points** for a completed-book claim.
5. **Completion**: reaching `target_count` closes the cycle and creates **one selectable reward entitlement**, not an automatically consumed reward.
6. **Claim**: the entitled participant picks **exactly one** active eligible reward from that book's configured list. Record who chose it, Room, recipient, completion cycle, chosen reward snapshot, status and fulfillment actor. Require a server-enforced unique claim per completed cycle (or equivalent unique entitlement).
7. **Repeat**: with repeatable books, the next cycle starts after completion per explicit settings, independently from claiming the previous reward. History of filled books and claimed rewards is retained permanently.
8. **Points and official Badges** remain separate optional systems. A Stamp Book reward is **not** a point redemption, and choosing decorative art does **not** mint a special official badge or bypass its actual criterion.

## Example (6 stamps)

- Room: "เรา 2 คน"; book: "ความใส่ใจของเรา"; target six.
- Four stamps already earned: heart, flower, star, bear, all credited by authorized approval.
- After two more accepted activities, the book becomes complete **6/6**.
- Available choices for this book: (A) choose a movie together, (B) a special dinner cooked by partner, (C) choose weekend activity.
- The recipient chooses **one**. A claim for A cannot be accompanied by another claim for B/C on the same completed cycle; refresh/replay/concurrent requests cannot issue twice.
- If canceled, define and audit whether eligibility reopens, before enabling cancel in UI. Fulfillment must be manager-confirmed.

## UI/UX flow

`/s/{spaceId}/stamp-books` displays **My Books** and Room books (respect participant/privacy scope).
- **Create Book:** name → target count → permitted stamp styles (picker of 18 art assets, not fixed by Couple/Family/Personal) → reward choices → approval policy → preview and save.
- **Book detail:** physical paper-book appearance, grid of empty outlined slots; each earned slot shows *actual selected stamp graphic*, date, giver, activity and review status. Current cycle `4/6` and archived previous cycles.
- **Give Stamp:** choose recipient and approved activity → stamp design picker showing only allowed designs → optional note → confirm. Only successful backend commit animates and updates progress.
- **Complete Book:** simple celebration, button "เลือกรางวัล" opens **one-of-N reward picker**. If options disabled/out of stock, show why and allow eligible alternatives.
- **Reward history:** requested, fulfilled or canceled, with a link to the book cycle. Current Points wallet never changes as a side effect of claiming this reward.
- Keep **Official Stamp Gallery** and **Permanent Badges** as a *separate Collection / Achievements tab*. They must never be represented as the same user-configurable book.

## Data model proposal (not yet executable migration)

| Domain | Suggested delta (preserve old rows) | Critical invariant |
| --- | --- | --- |
| Book definition | **Reuse** `stamp_cards` with nullable/new `book_mode='classic'|'custom_choice'`, style selection policy and creator/configuration | Official room-seeded cards retain classic behavior and cannot be arbitrarily mutated |
| Each stamp's selected image | Add `selected_stamp_asset_id` (or normalized one-to-one style table) on `stamp_awards`, referencing a vetted asset ID, with snapshot at approval time | For custom-choice books: **one committed award equals one stamp**; no client-set quantity or direct counter writes |
| Allowed art styles | New `stamp_book_allowed_styles(space_id, stamp_card_id, asset_id)` or versioned policy if 18-all is the initial default | Every selected image must belong to configured allowed styles; no arbitrary URLs/asset injection |
| Reward choices | New `stamp_book_reward_options(space_id, stamp_card_id, reward_id, enabled, sort_order)`; composite room-scoped FKs | Never show a reward from another Room; set options before book publication |
| Completion and claim | **First inspect** existing `stamp_prizes` and `stamp_cycles` real constraints; reuse if compatible. Otherwise propose a distinct `stamp_book_claims` with unique `(stamp_cycle_id)`, `reward_id`, `participant_id`, `space_id`, recipient status, reward-title snapshot and idem key | One entitled reward per cycle; atomic lock + eligibility + reward stock check + unique constraint |
| Manual stamp | Future audited event/source adapter compatible with authoritative award flow | Two-party approval where relevant, secure idempotency, no unverified counter increments |

**Do not build a parallel point wallet or a second progress ledger for the same book.** The existing `stamp_cycles` is the source of book progress. The existing `stamp_awards`/award RPC remains the authoritative event for approved missions, with a style snapshot per stamp. If manual stamping cannot be safely supported by the existing approved-submission invariant, ship the approved-activity version first, then add a separately audited manual-approval mechanism.

**Important:** The existing `pointplus_redeem_reward` RPC subtracts points. Stamp-Book claims MUST use a separate atomic, idempotent claim RPC (or a reviewed mode-aware existing routine) that does not alter point balances. Do not call point redemption with a fake zero price, fake points, or bypass stock controls.

## Security, consistency, concurrency

- Room isolation via `space_id`, participant and guardian eligibility on every SELECT/INSERT/UPDATE; user form fields are never trusted as authorization.
- Keep all new public tables protected by RLS, authenticated grants only as necessary, private claim/award RPC with explicit membership/eligibility and narrow EXECUTE grants; review SECURITY DEFINER/search_path.
- Each stamp event requires a unique approved source and recipient/book/cycle key. Implement optimistic/idempotent retry safely and `SELECT ... FOR UPDATE` on relevant cycle or entitlement.
- Unique cycle claim, immutable award style snapshots, no duplicate reward on retry. Snapshot reward/title and validate stock/visibility in the same transaction as claim.
- Counter should be recalculated from a trusted awards history (or kept in sync transactionally), not client localStorage.
- Changing targets, accepted art or reward options cannot retroactively change already-completed cycles/earned stamps. Archive/preserve history rather than deleting claimed rewards.
- Reward options only noncommercial, personal and mutually agreed. Child-specific guardian permissions require dedicated tests.

## Migration sequence (additional v3.x only)

1. Read-only inspect target `stamp_cards`, `stamp_cycles`, `stamp_awards`, `stamp_prizes`, `rewards`, `redemptions`, `badge_definitions`, status constraints, RPC defs and RLS. Existing v3 already applied; **do not run `02_upgrade_proposal.sql`**.
2. Create a separately versioned additive v3.x migration after backup/isolated restore; include new fields/tables, room-scoped FK/indexes, security rules and new claim RPC.
3. Backfill existing rows to `classic` without modifying awarded stamps, badges, wallets, redemptions or mission history; preserve existing active official catalogs.
4. Roll out behind a `custom_stamp_books` feature gate. Confirm old official earning and legacy redemption continue to work.
5. E2E: 1, 5, 6, 10 slots; 18 mixed styles; two Rooms; two adult users; Family guardian; double review; double claim; concurrent claim; canceled/fulfilled; out-of-stock; deletion/archival of options; no points charged.
6. CI, p95/TTFB, RLS and production-approval gates remain. **No Preview, Production deploy or merge** during design.

## Priority

This Stamp Book experience is the **primary R06/R07 user flow**. The original 18-stamp official collection and 12 permanent badges are retained as optional achievement galleries, not removed. Existing Point Rewards remains independent and optional.
