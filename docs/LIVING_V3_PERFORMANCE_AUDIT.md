# Living V3 — Navigation, Creation and Save Performance Audit

## Evidence and root causes

Source inspection based on Production \`main\` at
\`728315b1747e3f63c6c38048924c1ef109150d9e\`.

The read-only Supabase count check found a small dataset: **3 Living books,
1 V3 card, 5 book pages, 2 active decorations, 3 real stamp marks,
3 stamp requests, 0 redemptions, 0 legacy books and 0 legacy cycles**.
Therefore there is no evidence that sheer row volume caused the slowness.
Vercel runtime logs showed normal routed requests and no precise end-to-end
response-time measurements; all speed claims here are **architectural**, not
measured wall-clock improvements.

| Flow | Before | After |
| --- | --- | --- |
| Open one Living book | Read entire Room shelf + all card configs, then look up book, load unused summary RPC and last-page query | Fetch target book/card only, retaining authorized Room participants |
| Current-page media | Sequential marks, requests and giver reads; repeat page photo element read; sign photos later | Parallelize marks, requests, giver and limited photo-signing tasks; use already-loaded decoration paths |
| Open reader | Fetch full reward history, available candidate previews, pending history, per-redemption mark associations and artwork, even if rewards never opened | Fetch balance RPC + HEAD pending count only; load full history with an authorized Server Action only on modal opening |
| Room shelf | Load legacy books and cycles alongside active Living books | Load only Living books; keep old tables and deep links intact |
| Create a collection | Fetch Room members even though the V3 form does not use them | Fetch just authenticated Room context and recipient participants |
| Multi-object Save | One sequential browser Server Action per object | Up to 8 independently authorized/version-checked object writes in one browser Server Action; single-element flow remains identical |
| General Room layout | Duplicate CSS imports and legacy paper/journal loaded on every Room page | Import base shelf style once, load legacy paper/journal style only under stamp-book routes |
| UI | Technical "การ์ดสะสม V3" and "Living Stampbook" labels | Show human-readable titles and concise card/book descriptions |

## Non-negotiable safeguards

- No SQL migration or Production writes.
- Room member verification, owner checks, audit history, real stamp issuance,
  stamp approvals, card-slot occupancy, rewards and idempotency remain intact.
- The lazy redemption action first verifies a member's Room and exact
  \`(space_id,book_id)\` record under existing RLS before returning history.
- The batch decoration action delegates every entry to original
  \`saveLivingElement\` or \`transformLivingPhoto\`. Each RPC retains version checks
  and owner checks. Batch size is capped at 8 and duplicate IDs are rejected.
- A batch is **not atomic**: successful objects stay saved if a different
  object fails. The UI keeps unsuccessful drafts and reports partial failure.
- Photo uploads, soft deletes, real stamp issuance, stamp approvals and reward
  redemption are not included in the batch operation.
- All internal V3 tables and historical routes still exist. This PR removes
  only their unnecessary main-shelf loading, not the underlying data.

## Testing and release gates

CI includes \`tests/living-v3-performance.test.mjs\`, the original M01–M05
and UX01–UX04 tests, M23 card and security contracts, TypeScript/build, and
isolated PostgreSQL migrations and RLS checks.

Still required before release:

1. Run authenticated **Staging** browser tests (A/B couple) to verify creation,
   opening a book and card, issuing/approving stamps, partial paper Save and
   redemption on desktop and mobile.
2. Compare navigation and Save timings using real browser Performance traces
   and Next.js route spans against current Production.
3. Confirm rewards open and refresh correctly after requesting/fulfilling,
   that a denied Room member cannot fetch another Room's reward history,
   and that page/photo drafts remain safe in error/retry cases.
4. If slow creation persists after this PR, trace network RTT between Vercel
   compute and Supabase project and investigate individual auth/DB RPC timing.

**Do not infer a percentage or millisecond improvement from static source tests.**
