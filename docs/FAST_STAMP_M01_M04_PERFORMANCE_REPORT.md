# Point+ — Fast Stamp M01–M04 Performance & Release Verification
**Status: verification infrastructure implemented; LIVE STAGING GATES BLOCKED — NOT RELEASE READY**

## 1. Verified environment and commit
- Repository: `kzabCde/PointPlus`
- Feature branch: `feat/fast-stamp-performance-m01-m04`
- Pull request: [#37](https://github.com/kzabCde/PointPlus/pull/37), **OPEN / DRAFT**
- Head SHA to test: **read the exact head SHA and successful CI run shown in PR #37**; run the browser harness only if its `POINTPLUS_E2E_VERIFIED_COMMIT_SHA` matches `git rev-parse HEAD` in the checked-out fixture and the verified deployment's Git SHA.
- Existing `main` base: `4fe001dcf41d490b77f7cab8ab5a27fc8fbad444`.
- CI environment: GitHub-hosted Ubuntu, Node.js 22, locked npm install, Next.js 16, PostgreSQL 16 service with a synthetic auth/Room data fixture.
- Deployed Vercel project: `pointplus`. Read-only deployment inspection found only **Production/main** deployments, including production SHA `4fe001dcf41d490b77f7cab8ab5a27fc8fbad444`. A deployment with the feature branch SHA **was not found**. The project protects deployment URLs using Vercel SSO.
- Supabase read-only project enumeration: live Point+ database `gczribbtkfvhpzzupqre` is present and healthy, but a separate connected Point+ Staging Supabase project **was not identified**.
- Supabase read-only schema summary for Production shows `living_books`, `living_book_pages`, `living_book_givers`, `living_book_elements`, `living_stamp_requests`, `living_stamp_marks`, `living_stamp_events`, `living_stamp_redemptions`, and `living_book_cards` present with RLS enabled. This is **not** validation of function bodies or Staging schema and involved no writes.
- Neither a Staging deployment nor two Staging test accounts/session credentials are available in this run, therefore **NO authenticated hosted browser E2E or real browser latency was executed**. Only isolated CI and read-only configuration checks can be reported as executed.

## 2. Architecture — before and after

| Scenario | Earlier / main | Feature branch M01–M03 | Evidence |
| --- | --- | --- | --- |
| Give a stamp | Open book/card Editor, select asset and slot, confirm | Room/shelf Fast Stamp sheet, call the original permission-checked RPC | `fast-stamp-actions.ts`, `fast-stamp-button.tsx` |
| Open book | Load editor page list, decorations, marks and interactive editor components | Default read-only Reader loads one selected page and its media | `reader-data.ts`, `read-only-page.tsx` |
| Open card | Instantiate interactive card board | Render read-only numbered card, with actions available via explicit Edit | Living book route `?mode=edit` |
| Rewards | Old full history eager-loading refactored to on-demand in main | Reader loads summary only and dynamically imports reward workflow on disclosure | `read-rewards.tsx`, `redemption-data.ts` |
| Create book/card | Separate optional description/cover fields on default form | Minimal required fields; optional settings hidden; Couple auto-selects partner | `forms.tsx`, `creation-data.ts` |
| Creation write | Atomic `pointplus_create_living_book/card` | **Same atomic RPC**; frozen payload across retries | `actions.ts`, `creation-intent.ts` |
| Paper Save | Explicit Save and batched authorized decorations | **Unchanged** in M01–M04; real stamp confirmations persist immediately | Living V3 manual-save tests |

Earlier `docs/LIVING_V3_PERFORMANCE_AUDIT.md` was a **source/architecture comparison**, not measured wall-clock baseline. Its small production snapshot cannot establish performance gains.

## 3. Real-world timings (DO NOT GUESS)

| Metric | Baseline main (ms) | M01–M03 Staging (ms) | Conclusion |
| --- | ---: | ---: | --- |
| Room shelf ready | **Not measured** | **Not measured** | BLOCKED |
| Reader first visible paper | **Not measured** | **Not measured** | BLOCKED |
| Read-only card ready | **Not measured** | **Not measured** | BLOCKED |
| Enter full Editor | **Not measured** | **Not measured** | BLOCKED |
| Creation form ready | **Not measured** | **Not measured** | BLOCKED |
| Create Living Book | **Not measured** | **Not measured** | BLOCKED |
| Create V3 Card | **Not measured** | **Not measured** | BLOCKED |
| Open Fast Stamp sheet | Not available in main | **Not measured** | BLOCKED |
| Confirm real Fast Stamp | Not available in main | **Not measured** | BLOCKED |
| Manual paper Save | **Not measured** | **Not measured** | BLOCKED |

**No median, p95, millisecond improvement or percent improvement can be asserted from this run.** No synthetic benchmark data are presented as real traffic.

### Measurement methodology — ready for Staging
- `tests/e2e/fast-stamp-m04-staging.mjs` is an opt-in, write-capable **isolated Staging only** two-account browser/DB harness. It must NOT be added to generic PR CI.
- Navigation: 3 warm-up iterations followed by **22 timed reloads per scenario/device**; wait for the real visible target. Desktop viewport `1280×850`; mobile touch viewport `390×844`, reduced motion. Samples are monotonic wall times measured by Node `performance.now()`.
- Single create/stamp transactions get **one genuine sample each** and therefore have **p95 = null**; do not exaggerate statistical confidence.
- Scenarios: `shelf_ready`, `reader_ready`, `card_ready`, `editor_ready`, `creation_form_ready`, `create_book_confirmed`, `create_card_confirmed`, `fast_stamp_sheet_ready`, `fast_stamp_confirmed`.
- The numeric-only JSON sample file contains no test account emails, IDs, passwords, session cookies, private image URLs, or network traces.
- `scripts/m04-performance-summary.mjs` calculates exact median and nearest-rank p95 **only with at least 20 samples**. It computes a before/after delta only when environment and network/device conditions match. No fabricated baseline.
- Browser navigation timings include client rendering, navigation and network; they **do not** separately identify Next.js server time, Supabase RPC time or Vercel↔Supabase RTT. Collect request-scoped Vercel traces + Postgres query/slow-RPC samples on **Staging only** before attributing a bottleneck to a particular layer.

## 4. Verification evidence and blockers

| Gate | Status | Evidence |
| --- | --- | --- |
| M01 Fast Stamp source/behavior contracts | Automated CI | `tests/fast-stamp-m01.test.mjs` |
| M02 Reader, card and rewards SSR | Automated CI | `tests/fast-stamp-m02-reader.test.mjs` |
| M03 Fast Creation immutable retries | Automated CI | `tests/fast-stamp-m03-creation.test.mjs` |
| M04 numeric performance summary and strict Staging isolation | Automated CI | `tests/m04-performance-verification.test.mjs` |
| Legacy UX01–UX04, Living V3 M01–M05, M23 and paper Save | Automated CI | `.github/workflows/ci.yml` |
| Isolated PostgreSQL migrations, RLS, ledger and concurrency | Automated CI | CI PostgreSQL job |
| TypeScript + Next.js production build | Automated CI | CI verify job |
| Legacy two-account Editor/Card browser scripts | **Syntax check only** | Original Editor-specific scripts now request `?mode=edit` explicitly |
| Browser two-account A↔B on branch deployment | **BLOCKED / NOT EXECUTED** | No branch-specific Staging URL or isolated Staging database |
| Real mobile UI/keyboard/focus/private photo expiry | **BLOCKED / NOT EXECUTED** | Needs Stage browser |
| Network ambiguity, retry with same key across refresh | **BLOCKED / NOT EXECUTED** | Requires running Staging browser scenarios |
| Before/after real latency, Vercel/Supabase span breakdown | **BLOCKED / NOT EXECUTED** | No comparable staging baseline/deployment |
| Reward request/fulfillment, slot race in real two-account browser | **BLOCKED / NOT EXECUTED** | Harness prepared, not run |

**CI labels must never be conflated with authenticated Staging E2E.** Syntax-checking a browser file does not execute any real browser tests.

## 5. How to finish the release gates safely

1. **Manually provision** a separate Point+ Supabase Staging project with synthetic test data, exact relevant Living V3 M01–M05 + M23 migrations, isolated photo Storage, and two disposable Couple accounts A/B. Do not copy real user records or use production service-role keys.
2. **Manually establish** a staging-only Vercel Preview deployment for PR #37's exact tested commit, with `NEXT_PUBLIC_SUPABASE_URL` pointing to the isolated Staging project. A protected Preview may require the platform's authorized browser bypass mechanism. No deployment is performed by this PR.
3. Inspect Vercel deployment metadata independently: environment Preview (not Production), Git repository, branch and exact commit SHA. Set `POINTPLUS_E2E_PREVIEW_VERIFIED=1` and `POINTPLUS_E2E_VERIFIED_COMMIT_SHA` *only after that verification*. The harness checks it against the local test checkout.
4. Configure `POINTPLUS_E2E_*` credentials in a trusted local process/CI environment; do not commit or paste passwords, JWTs, tokens or Supabase secret keys into PR comments or files.
5. With prerequisites met, run the authenticated harness: `node tests/e2e/fast-stamp-m04-staging.mjs`. It creates real **Staging** test collections, stamps and redemptions; inspect all results, including denied actions and concurrent slot conflicts.
6. Run the existing `test:e2e:living`, UX04 browser and V3 Card browser scripts against that Staging environment. Verify mobile viewport, focus and touch, photo crop, unsaved paper edits, partial-save rollback and real reward state.
7. Export anonymized samples to `POINTPLUS_E2E_METRICS_OUTPUT`, then run `node scripts/m04-performance-summary.mjs --after <stage-samples.json>`. For baseline comparison, separately test a matching `main` deployment against an **equivalent isolated staging dataset** and pass it via `--before`. Never compare unrelated Production/staging datasets as directly equivalent.
8. Record actual medians/p95, server/RPC timings if available, failures and release blockers. Only then request review. Do not auto-merge or promote.

## 6. Remaining risks
- M01 best-effort free-placement can still overlap under concurrent independent stamps. Card unique-slot constraints remain database-authoritative.
- M02 Reader reads only current-page decorations but a very dense individual page still has unbounded total work in bounded batches.
- Long-idle private signed photos may expire; reloading signs the URLs again.
- M03 tab-local `sessionStorage` replay loses durable intent if disabled and the tab crashes; unresolved writes require manual reconciliation.
- Staging browser scripts are not proven to match the currently deployed UI until executed; selector failures must be triaged rather than marking scenarios passed.
- No evidence for actual median/p95 performance or Vercel↔Supabase RTT at this stage.

## 7. Rollback and release policy
- Changes are isolated to PR #37; **no SQL migrations** were introduced in M01–M04.
- Do not merge, promote or deploy while the Staging and measurement gates are blocked.
- If release is later authorized, revert the feature merge on `main` or roll back the previously verified Vercel deployment; do **not** delete stamp/ledger records to roll back UI behavior.
- The original V3 RPCs, approval, redemptions, paper Save and reader's editable `?mode=edit` remain the canonical fallback.
- **Final recommendation: keep PR #37 DRAFT / RELEASE BLOCKED until missing Staging evidence is obtained.**
