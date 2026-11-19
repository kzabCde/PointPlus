# PointPlus

PointPlus is a non-commercial, Thai-first application for people supporting each other through meaningful missions: personal goals, couples and families. Points, stamps and badges are personal encouragement, **not money, sales rewards or store loyalty**.

## Status
Phase 1 — M01 foundation and UI architecture. The landing page is informational, and `/dashboard` is a protected scaffold. Account registration, authentication forms, mission creation and real dashboards are **not implemented yet**.

## Local development

Requires Node.js 22+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local`.

The only required environment variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are publishable browser values; never put a Supabase service-role or secret key under `NEXT_PUBLIC_`. Configure values separately in Vercel's environment settings. Local `.env.local` is ignored by Git.

## Source structure

- `app/(public)/page.tsx`: live public landing page (no demo todos or fictional stats).
- `app/(auth)/layout.tsx`: auth UI layout prepared for M02.
- `app/(protected)/`: verified-session app shell and M01 dashboard scaffold.
- `components/ui/`, `components/brand/`: reusable presentation building blocks.
- `app/globals.css`: design tokens, responsive and accessibility styling.
- `utils/supabase/client.ts` and `server.ts`: existing SSR browser/server clients.
- `utils/supabase/middleware.ts` and `proxy.ts`: existing session refresh; do not bypass.
- `lib/point-plus/assets.ts`: imported assets registry for future stamps/badges, not active reward logic.
- `docs/PHASE1_M01.md`: M01 architecture, constraints and verification.

## Checks

```bash
npm run test:foundation
npm run typecheck
npm run build
node scripts/validate-point-plus-assets.mjs
```

Database v2.0 is authoritative for later feature work. Do not invent table columns or RPCs and do not run SQL against another Supabase project.
