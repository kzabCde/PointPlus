# PointPlus — Tap a Numbered Stamp Card Slot

## User interaction
1. Open a collection with `layout_mode = 'stamp_card'`.
2. If allowed to give stamps, select **any empty numbered cell** on the card. There is no separate Give Stamp button in the page header.
3. A small accessible dialog opens for exactly that numbered cell. Choose one of the creator-approved stamp artworks, optionally add a note, then confirm.
4. A direct-approval card records the stamp in that exact cell and plays the existing sound once a server receipt confirms it. An approval-required card shows a muted waiting stamp in the reserved cell until approval.
5. Filled/reserved cells cannot be used again. Archived, paused and completed card cycles remain read-only. Any click is permission-checked by the pre-existing authorization RPC.
6. The notebook and one-sheet paper use their original free-placement UI and are not affected.

## Authoritative database state
Migration: `supabase/stamp-book-first/15_card_click_to_stamp.sql`.

- Adds nullable `slot_index` to `stamp_book_stamp_requests` and `stamp_book_marks`. Null marks from existing cards retain their historical numbered display.
- Per-cycle unique confirmed-slot index, plus a partial unique index against concurrent pending reservations for the same card/recipient/slot.
- Versioned authenticated `pointplus_give_stamp_to_card` RPC validates book type, selected slot bounds, historical occupancy and pending requests; it reuses `pointplus_give_stamp` to preserve giver authorization, note checks, cycle increment, idempotency, and any approval requirement.
- Pending approvals inherit their saved cell using a private mark-insertion trigger, with no modification to `pointplus_review_stamp_request`.
- Existing Couple memory redemption, optional free-text reward and archived immutable history are unchanged.
- The final direct-grant mark, pending request and card index update are one Postgres transaction; when validation fails, all changes roll back.

## Release gates
- Do not rerun migrations 12–14 or modify existing card marks while introducing the nullable column.
- Run `node --test tests/stamp-card-choice.test.mjs tests/stamp-card-tap-slots.test.mjs`, then repository CI typecheck/build.
- Validate signed-in two-user, direct and approval-required interactions, concurrent requests for the same slot, idempotent retries, completed and archived cards, keyboard/touch access, sound, and both legacy/fresh cards.
- Apply migration 15 before any frontend deployment. Keep this feature Draft and avoid Vercel Preview and Production deploy until the release is explicitly approved.
