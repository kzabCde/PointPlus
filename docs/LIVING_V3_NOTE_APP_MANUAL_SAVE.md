# Point+ — Compact Notebook & Manual Save

## Inspiration (behavior only, no cloned product assets)

- [Goodnotes — Improved User Interface](https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface):
  dedicated paper area, context-specific editing toolbar and overflow controls.
- [Goodnotes — Customize Toolbar](https://support.goodnotes.com/hc/en-us/articles/8900755183631-Customize-the-toolbar):
  ability to hide writing tools to reclaim document space.
- [Goodnotes — Read-Only Mode](https://support.goodnotes.com/hc/en-us/articles/7353757120655-Use-Read-Only-Mode-to-navigate-without-editing):
  clean reading mode.
- [Notability — Focus Mode](https://support.gingerlabs.com/en-us/articles/16300005-focus-mode):
  leave the page center-stage and close secondary panels.
- [Noteful — App Store](https://apps.apple.com/us/app/noteful-notes-pdf-markup/id1587904334?platform=ipad):
  compact toolbar and fewer taps in the writing workflow.

These are **visual interaction references**, not dependencies, source code,
design assets, or permission to reuse application screenshots commercially.
Unlike Goodnotes/Notability, Point+ explicitly saves ordinary paper edits only
on the user's **Save** command.

## Behavior

| Action | Persist | Details |
|---|---|---|
| Type/edit text | Explicit Save | Local page draft, edit inline |
| Draw pen strokes | Explicit Save | Stroke preview only until Save |
| Move, resize, rotate, crop, style decorations | Explicit Save | Direct manipulation staging |
| Delete paper decoration | Explicit Save | Local removal, server version-checked soft-delete on Save |
| Change page title/background | Explicit Save in page overview | No debounce write |
| Pick/drop photos | Explicit Save | Prepared bytes queued only in current tab; import after Save |
| Give a REAL stamp | Immediately on explicit stamp confirmation | Original authenticated `giveLivingStamp`/RPC with idempotency |
| Approve/reject a stamp | Immediately on explicit reviewer action | Real ledger and audit history |
| Transform/peel a confirmed real stamp | Immediately on explicit user action | Ledger integrity remains server-owned |
| Redeem/finalize a reward | Immediately on explicit authorized action | Original M04 and M23 rules |

**No new migration.** No room, book, stamp, reward, audit or RLS changes.

## UI decisions

- Compact single-line header, page counter, minimal 44px touch controls.
- Tool and page-overview panels render in document flow, not over the page.
- Context-specific selected-object controls appear only when selected.
- Focus Mode hides page navigation and editing controls, not the Save strip
  for unsaved paper edits.
- Explicit Save strip appears only when pending; Ctrl/Cmd+S supported for the
  paper. Discard requires confirmation. Page settings use own Save.
- Unsaved paper and page settings block page navigation; leaving through
  notebook back link is blocked with a notice.
- Before-unload warning protects from accidental hard reload/close.
- Paper canvas has almost no decorative border/padding on narrow screens.
- No default always-visible image queue/toolbars/history/debug banners.

## Limits / release blockers

1. Drafts live in client memory. Browser crashes or session loss may lose
   changes before Save. Never label drafts as server-saved.
2. A Save batch writes individual decorations and photos sequentially; if the
   connection breaks midway, already committed changes remain, while failed
   and uncommitted items stay staged for retry. Verify the page before retry.
3. Photos selected for import are **queued** and shown by filename; after
   pressing Save they appear on paper. The existing photo action may not
   perfectly de-duplicate an uncertain network result; check your book before
   retrying if connectivity is unstable.
4. Undo/Redo history remains for **confirmed saved** paper changes, not a full
   reversible timeline of unsaved edits. Use Discard to reset local drafts.
5. Browser back/history navigation via browser UI may not be covered by every
   SPA route guard; hosted browser tests required.
6. Visual size and touch ergonomics require real mobile and desktop checks.
7. Two-account staging E2E is required to verify stamps, permission boundaries,
   redemption and simultaneous edits.

## Verification

- [ ] Next.js build and TypeScript
- [ ] Manual-save specific contract tests
- [ ] Existing UX01–UX04, M01–M05, M23/card tests
- [ ] Isolated Postgres migration/RLS tests
- [ ] Mobile and desktop authenticated Staging E2E
- [ ] Manual iOS Safari keyboard/touch and Android Chrome checks

**Release gate:** keep PR #35 Draft; do not merge or deploy or change
Production database before the above tests.
