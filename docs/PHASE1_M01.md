# PointPlus — M01 Foundation & UI Architecture

## Scope
Only **Phase 1 / M01**. This implementation does not create accounts, missions, assignments, points or any Supabase rows.

## Routes
- `/`: public, informational, Thai-first landing page; links navigate only to real sections on the page.
- `/dashboard`: server-protected route shell, available only to authenticated users with a verified Supabase JWT. Until M02 adds authentication screens, unauthenticated visitors return to `/`.
- `app/(auth)/layout.tsx`: layout ready for M02 authentication screens; no unused visible menu entries.
- Global not-found and error patterns and dashboard loading/error boundary.

## Design
- Tokens, adaptive layout and accessible focus styling in `app/globals.css`.
- Reusable UI primitives: Button, ButtonLink, Card, FormField, StatusIndicator and native Dialog.
- Warm cream, teal and coral visual direction, with a heart brand mark rather than a purple theme.
- Stamp illustrations reference existing checked-in assets. They are **clearly labeled examples** and do not represent earned awards.
- Reduced-motion, visible focus, semantic navigation, and responsive grid support.
- No network fonts, paid UI packages, sample points or mock mission data.

## Data, authorization and safety
- Existing `utils/supabase` and Next.js 16 `proxy.ts` remain unchanged.
- `getClaims()` is used in the protected layout; no client-side membership or role claims are trusted for mutations.
- No PointPlus database table queries are added during M01.
- **Blocked verification**: the connected Supabase integration does not have permission to access target project `gczribbtkfvhpzzupqre`. Do not inspect or modify any other project. Re-verify v2.0 schema and RLS from an authorized connection when available.
- Supabase TypeScript types must be generated from that real database rather than invented locally; defer until authorized access is available.
- No `service_role` or secret keys added. Only existing public publishable configuration is used.

## Verification
Run `npm ci`, `npm run test:foundation`, `npm run typecheck`, `npm run build`.
CI runs these checks plus the pre-existing artwork validator.
Manual QA still needed: keyboard traversal, mobile device views, session expiry, authenticated dashboard access, Supabase target schema/RLS.

## Next
M02 will implement real Supabase sign-in, sign-up, sign-out and recovery. M03–M10 will connect verified PointPlus data in their respective missions.
