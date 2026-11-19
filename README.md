# PointPlus

Next.js 16 App Router foundation with Supabase SSR authentication helpers for the PointPlus rewards web app.

## Local setup

Requires Node.js 22+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, copy environment variables with `Copy-Item .env.example .env.local`.

The publishable key is intended for browser clients. **Never** put a Supabase secret key or service-role key in a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel's environment settings separately.

## Supabase clients

- `utils/supabase/client.ts`: browser client for Client Components.
- `utils/supabase/server.ts`: per-request server client using Next.js cookies.
- `utils/supabase/middleware.ts`: session refresh helper; applies cookie and cache headers.
- `proxy.ts`: Next.js 16 entry point for automatic session refresh.

The home page includes an **optional** example query to a `todos` table. This setup does not create tables, RLS policies, user login screens, or PointPlus reward logic. If the demo table does not exist or is inaccessible under RLS, the page displays an explanatory message rather than failing.

## Checks

```bash
npm run build
npm run typecheck
```

Optional agent instructions (not needed for app runtime):

```bash
npx skills add supabase/agent-skills
```
