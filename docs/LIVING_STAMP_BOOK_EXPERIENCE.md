# Living Stamp Book

## Baseline and mission commits

The feature branch `feat/living-stamp-book-experience` starts at `6a2eb51` on `main`. Git refs and merge history confirmed PR #17 (Stamp Book motion) and PR #18 (streamlined onboarding, Room creation, and Couple Books) were already integrated. The GitHub API refused the open-PR query. The requested branch name was free.

| Mission | Implementation and verification |
| --- | --- |
| M01 · `850458b` | Replaced the old landing with a responsive hero, a reusable paper book, and three clearly labelled illustrative stories. The main and footer CTAs use existing auth routes. Signed-in visitors at registration go to Rooms. Type checking, the 71 baseline tests, and Chromium open, page, close, and CTA checks passed. |
| M02 · `5c827fe` | Extended the shared motion tokens, reused the journal’s leaf turn, and added a bounded mascot reaction, a physical sample stamp press, and one-time viewport reveals. Chromium verified motion-enabled and reduced-motion interactions plus keyboard operation. |
| M03 · `033c2a5` | Streamed the opening scene in the verified protected route fallback. The fixture verified wrong credentials, a held password response, slow Room data, onboarding, deep links, refresh, and reduced motion. |
| M04 | Audited production rendering, reduced font and artwork transfer sizes, added auth regression tests to CI, and ran the responsive and accessibility matrix. Callback and recovery fixes are covered by the regression tests below. |

## UI architecture

- `app/(public)/page.tsx` stays a static Server Component with the existing SEO title, layout metadata, anchors, and brand mark. The interactive preview, stamp demo, and single intersection observer are the small client components under `components/landing/`. The example names, counts, and messages stay in those static illustrations.
- `components/motion/` shares the paper spine, cover, and stamp press with the authenticated fallback. The cover rotates around its spine in 780 ms, a demo leaf turns in 360 ms, and a stamp makes contact and settles in 450 ms. The full journal retains its 600 ms leaf turn. The original mascot is animated as a whole image with two bounded breaths and a short stamp-side reaction.
- Motion affects opacity and transforms. The server-rendered content stays readable before the viewport observer runs, and each section is unobserved after its first reveal. Controls stay active during motion. Reduced motion leaves the book and controls usable without rotation, scale, or scroll reveal.
- Optimized image sizes match the cover and the open slots. Stamp details load when the preview opens, below-the-fold illustrations retain lazy loading, and the loading scene references just the small mascot and one stamp. The existing Noto Sans Thai faces now ship as WOFF2. Their character maps, glyph order, advance widths, and naming metadata matched the source faces after conversion.

## Authentication and readiness

The existing password Server Action still verifies credentials, uses the same profile check for onboarding, sanitizes `next`, and redirects to the approved destination. A hydrated password form can request a 45-second visual hint. Only a successful action can set that hint, and the protected layout and loading boundary verify Supabase claims before using it. The hint contains a constant presentation flag. The layout clears it when the authenticated shell mounts.

Credential submission has its own status announcement. The opening scene belongs to the route’s actual loading boundary and remains only while destination data is pending. A fast response may skip the scene. Slow responses keep the settled illustration and the same status text. The ready view fades in when the fallback leaves. No network step waits on an animation.

Password navigation replaces the login history entry, so Back can leave a pending destination. Invitation fragments remain in the join page’s client-side handoff. Recovery and email callbacks use the existing Supabase exchange and OTP verification. Their redirect now uses a validated relative Location to retain the browser host and its session cookie, including behind an alternate local hostname. The protected error boundary uses Next.js’s re-fetching Retry action.

The branch retains the integrated Couple Book flows and makes no changes to RLS, RPCs, schema, or stamp persistence. The hosted Supabase health request was blocked by the egress proxy. Live email delivery, production RLS and reciprocal multi-account behavior remain unverified.

## QA results

| Check | Result |
| --- | --- |
| Clean install, TypeScript, production build, official asset catalog | Passed `npm ci`, `npm run typecheck`, `npm run build`, and `node scripts/validate-point-plus-assets.mjs`. Asset validation checked 18 stamps and 12 badges. |
| Foundation and auth regression tests | All 75 passed with `node --test tests/*.test.mjs`. Four new cases covering the visual hint, history behavior, and safe callback redirects also run in GitHub CI. |
| Production landing | Passed in Chromium at 320, 375, 390, 768, 1024, and 1440 px widths and 844 × 390 landscape. The book stays within its space in both states. Tap, Tab, Enter, Space, and arrow keys work. The sample stamp appears and can be cleared, and both public CTAs reach the expected forms. Cover, leaf, press, mascot, and reveal animations start with motion enabled. The same controls work with reduced motion. |
| Production password sign-in | The local HTTP fixture passed valid and invalid credentials, slow credentials and slow Room data, `/rooms`, onboarding, safe `next`, direct protected entry, expired session, refresh, sign-out and sign-in, Back while loading, reduced motion, and recovery from a failed Room request. No entry scene appeared before credential verification or after an auth failure. |
| Registration, recovery, and invitations | The fixture verified signup and email confirmation, recovery request and PKCE callback, expired callback handling, and an invitation opened anonymously, reopened after login, and accepted using the fragment. The native form also verified credentials and issued the session and redirect with JavaScript disabled. |
| Existing Room and journal flows | The Phase 02/03 Chromium fixture passed keyboard, touch, dialogs, reduced motion, historical and repeat cycles, Room wizard validation and retry, stamp request and award, reward fulfillment and cancellation, invitations, and notifications. |
| Accessibility | axe WCAG 2.0 and 2.1 A/AA scans passed on the closed and opened mobile landing, login, and authenticated loading state. Keyboard checks covered the skip link, demo controls, dialogs, and navigation. Focus indicators use the existing focus token, and the loading graphic is decorative beside a single live status. No browser page errors were recorded by the new suites. |

There were no failing or skipped automated checks in these runs. Device safe-area behavior on physical hardware, Safari and Firefox, and a dedicated screen-reader session remain unverified. The auth suite uses deterministic service responses. The JavaScript-disabled check covers the server form contract. Next.js still needs its runtime to progressively reveal streamed protected content.

## Performance

Three samples per profile used fresh Chromium 156 browser contexts against local Next.js production builds. Desktop was 1440 × 1000 at native speed. Mobile was 390 × 844 with 4× CPU slowdown, 150 ms simulated latency, 200 KB/s download, and 90 KB/s upload. Times are medians unless otherwise noted. Byte counts use `encodedBodySize` for resources loaded before the first interaction.

| Metric | Baseline desktop | Branch desktop | Baseline mobile | Branch mobile |
| --- | ---: | ---: | ---: | ---: |
| LCP | 132 ms | 144 ms | 600 ms | 580 ms |
| CLS | 0 | 0 | 0 | 0 |
| Document response | 9 ms | 12 ms | 10 ms | 9 ms |
| Load event end | 198 ms | 155 ms | 1,629 ms | 1,627 ms |
| Initial JavaScript | 149,098 B | 149,670 B | 147,272 B | 149,670 B |
| Initial CSS | 5,219 B | 8,788 B | 5,219 B | 8,788 B |
| Initial fonts | 38,923 B | 31,576 B | 38,923 B | 31,576 B |
| Initial images | 6,034 B | 5,206 B | 6,034 B | 4,244 B |
| Slowest sampled interaction | — | 32 ms | — | 72 ms |
| Cover frame interval, 95th percentile | — | 16.7 ms | — | 16.7–16.8 ms |

All six branch LCP samples were under 2.5 seconds and CLS was zero. Chromium Event Timing sampled two to three interactions per run during cover opening, paging, and stamping. These lab samples cannot establish field INP. The cover turn recorded 46 desktop frame intervals and 44–47 mobile intervals. Initial transfer for fonts and images fell by 8,175 bytes on desktop and 9,137 bytes on mobile, with additional CSS and JavaScript for the interactive book.

The production auth fixture measured 79 ms from releasing credentials to the visible fallback, 33 ms from releasing Room data to visible content, and 162 ms for a warm password form flow to visible Rooms. These local measurements include browser and fixture overhead. The route adds no minimum animation duration.

To repeat the browser checks, supply `POINTPLUS_PLAYWRIGHT_CORE` for a local `playwright-core` module, `POINTPLUS_AXE` for `axe.min.js`, and optionally `POINTPLUS_CHROMIUM` for a browser binary. Set `POINTPLUS_LIVING_URL` to a running production build for `node tests/browser/living-experience.mjs` and `node tests/browser/living-performance.mjs`. Run `POINTPLUS_AUTH_PRODUCTION=1 node tests/browser/living-auth.mjs` for the production auth fixture and `node tests/browser/phase02.mjs` for the journal fixture. The auth fixture builds and starts its own local server. `POINTPLUS_SCREENSHOTS` selects an output directory for the landing and auth screenshots.

## Visual verification

- [Desktop landing](screenshots/living-stamp-book/landing-1440.png) · [Mobile landing](screenshots/living-stamp-book/landing-390.png)
- [Desktop open book](screenshots/living-stamp-book/open-book-1440.png) · [Mobile open book](screenshots/living-stamp-book/open-book-390.png)
- [Opening scene](screenshots/living-stamp-book/post-login-cover-opening.png) · [Stamp contact](screenshots/living-stamp-book/post-login-heart-stamp.png) · [Settled impression](screenshots/living-stamp-book/post-login-impression.png) · [Rooms](screenshots/living-stamp-book/post-login-rooms.png)

The protected screenshots use the local fixture account and sample Room data. Its membership response was held for the animation captures and released for the final Rooms capture. The screenshots capture actual browser output.

## Release readiness

The branch is ready for human review. Hosted authentication, reciprocal behavior with two live accounts, and production Core Web Vitals still need verification for release. The checked-in workflow runs validation only. The linked Vercel project's Preview Deployments are recorded as disabled in the [Phase 2 progress log](PHASE2_PROGRESS.md). No Vercel action, merge to `main`, or Supabase write was performed during implementation and testing.
