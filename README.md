# PointPlus

PointPlus is a non-commercial, Thai-first application for people supporting each other through meaningful missions: personal goals, couples and families. Points, stamps and badges are personal encouragement, **not money, sales rewards or store loyalty**.

## Status
Phase 1 — M01–M07 implemented. Auth, profiles/onboarding, spaces, invitations, child profiles and read-only Mission Board are available as code. Mission creation/submission, points, redemption and stamp/badge awarding are **not yet implemented** (M08+). Live target Supabase permission is still unavailable; do not claim end-to-end functionality has passed.

## Local development

Requires Node.js 22+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local`.

The application also needs `NEXT_PUBLIC_SITE_URL` set to its canonical origin in production (for email confirmation, password recovery and invitations). The Supabase project's Auth URL configuration must allow `/auth/callback`. The required Supabase client environment variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are publishable browser values; never put a Supabase service-role or secret key under `NEXT_PUBLIC_`. Configure values separately in Vercel's environment settings. Local `.env.local` is ignored by Git.

## Source structure

- `app/(public)/page.tsx`: live public landing page (no demo todos or fictional stats).
- `app/(auth)/`: sign-in, registration, recovery and reset-password screens.
- `app/(protected)/`: protected application shell, onboarding, profiles, spaces, memberships, children and mission views.
- `components/ui/`, `components/brand/`: reusable presentation building blocks.
- `app/globals.css`: design tokens, responsive and accessibility styling.
- `utils/supabase/client.ts` and `server.ts`: existing SSR browser/server clients.
- `utils/supabase/middleware.ts` and `proxy.ts`: existing session refresh; do not bypass.
- `lib/point-plus/assets.ts`: imported assets registry for future stamps/badges, not active reward logic.
- `docs/PHASE1_M01.md`: M01 architecture, constraints and verification.

## Checks

```bash
npm run test:foundation
node --test tests/phase1-m02-m07.test.mjs
npm run typecheck
npm run build
node scripts/validate-point-plus-assets.mjs
```

Database v2.0 is authoritative for later feature work. Do not invent table columns or RPCs and do not run SQL against another Supabase project.
