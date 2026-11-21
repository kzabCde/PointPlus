# Point+ Fast Stamp & Performance Refactor — M03 Fast Creation

Branch: `feat/fast-stamp-performance-m01-m04` · **Same open Draft PR #37** · M01 and M02 retained. **M04 not started.**

## Implementation
1. **One-step creation**: users select Living Book or Stamp Card. Book requires title and recipient; Card requires title, recipient, target slots (default 6) and reward. A Couple with one eligible other member gets the recipient preselected via a hidden field. Other Room types retain a dropdown and existing Role validation.
2. **Advanced settings deferred** behind a native disclosure: description, cover and (non-Couple) direct/approval-required setting. No large image preview, no wizard and no heavy artwork rendered on initial creation.
3. **Lean reads**: the new `loadCreationRecipients()` queries only active Room participants' `id,kind,user_id,display_name`. The creation route still loads the authenticated `getSpaceContext`, which React-caches same-request membership checks; neither the shelf nor reward history is loaded. No extra participant/member query is introduced.
4. **Single authorized atomic RPC** per creation, preserving existing `createLivingBookAction → pointplus_create_living_book` and `createLivingCardAction → pointplus_create_living_card`. The PostgreSQL functions still validate membership, recipient, role, creator, initial giver, initial page, card setup and idempotency.
5. **Retry-safe original command**: before the first Server Action dispatch, the form's complete submission is frozen with one UUID and stored in tab-local `sessionStorage` (scoped by user, Room and format). If the response is ambiguous, browser reload or another submission replays exactly the original payload and key. It never derives a new key merely because of a timeout. Pending submissions disable the button; the action handler has an additional in-memory duplicate guard.
6. **Recovery**: after confirmed success the stored intent is cleared and the user navigates directly to the read-only Living Reader / Card from M02. If an attempted operation failed or was ambiguous, the locked view shows the previous inputs and offers a same-key retry. Starting a fresh logical operation is deliberately gated behind an explicit confirmation asking the user to inspect the Room shelf first; it is not automatic.
7. **No schema or Production changes**. All existing stamps, rewards, Room accounts, manual paper Save and Fast Stamp remain unchanged.

## Security / idempotency
- The Client's recipient/role/cover cannot grant permission; all access is rechecked by existing authenticated Server Actions and SQL RPCs.
- The SQL `creation_key` and same-room lock prevent identical concurrent creations; existing RPC rejects changing the original input with the same key. M23 cards additionally reject incompatible target count/reward on reuse.
- On retry the same **whole** payload is sent, not merely the same key with edited fields.
- An ambiguous server response is **not** proof of a failed write. The user must inspect their collections before explicitly discarding an unresolved intent.
- Session storage may be disabled; then retries are safe while the tab remains mounted, but a browser crash requires manual reconciliation. This is an acknowledged limitation, not a solved exactly-once guarantee without durable server-backed reconciliation.
- The form never inserts into SQL tables directly and never invokes more than the original one creation RPC for a logical create.

## Verification
- `tests/fast-stamp-m03-creation.test.mjs` exercises minimal creator SSR, automatic Couple recipient, advanced configuration, complete payload freezing/replay, card/book RPCs, role checks, input validation and schema invariants.
- CI continues to run M01 Fast Stamp tests, M02 Reader SSR/navigation tests, the existing Living V3 M01–M05 and Card/M23 suite, UX01–UX04, TypeScript, build and isolated PostgreSQL migration/RLS fixtures.
- Browser-based authenticated two-account **Staging** E2E is pending M04; verify both Couple directions, duplicate retry after ambiguous timeout, Creation + Fast Stamp + Reader navigation.
- No real latency numbers are reported before M04, and no Production deployment was performed.

## Potential limitations / release blockers
- First-render creation still needs authenticated Room context and one participants query; actual endpoint timings have not been recorded.
- An extremely small delay between submitting and React pending state is also protected by the synchronous `submitLock`.
- Storage-denied/crashed-tab retry cannot transparently restore the old key.
- Manual visual inspection on mobile, accessibility keyboard navigation, and two-account end-to-end execution are still required.

## Stop
Next milestone: **M04 — Performance Verification. Do not start without explicit instruction. Keep PR #37 Draft. Do not Merge, Deploy, or alter Production.**
