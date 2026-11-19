# PointPlus

PointPlus is a non-commercial, Thai-first application for people supporting each other through meaningful missions: personal goals, couples and families. Points, stamps and badges are personal encouragement, **not money, sales rewards or store loyalty**.

## Current implementation status (2026-11-20)

The Room-First application is in the repository, including sign-up, login, profiles,
Room switching, invitations, missions, approvals, personal rewards and collections.
The connected PointPlus Supabase project (`gczribbtkfvhpzzupqre`) has v3 objects
already installed; incremental v3.1/v3.2 migrations are now applied and verified.

A live RLS regression was found in Room creation: using `INSERT ... RETURNING id`
before the AFTER INSERT membership trigger made creating new Rooms fail.
**Draft PR #12** generates the Room ID in the Next.js server action and performs
the insert without `RETURNING`. It also restores official Room collections and
adds assignment notification handling. The DB migrations are already live,
but the application code in PR #12 is **not merged or deployed**.

Rollback-only SQL smoke tests passed for Group Room provisioning and a Personal
Mission → auto-approval → points → stamp → badge sequence. This does not replace
two-user/browser E2E, security adversarial testing, restorable-backup verification
or measured performance. Do not deploy before complete release acceptance.

See `docs/DATABASE_V3_LIVE_AUDIT.md` and `supabase/v3/README.md`.

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
node --test tests/phase1-m08-m10.test.mjs
npm run typecheck
npm run build
node scripts/validate-point-plus-assets.mjs
```

See docs/PHASE1_M08_M10.md for the M08–M10 engineering report and 12 untested live acceptance scenarios.

The verified live v3 schema is authoritative for PointPlus. Do not rerun the original v2→v3 migration proposal, invent missing columns/RPCs, or run SQL against any other Supabase project.
