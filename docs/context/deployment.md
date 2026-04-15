# StrataHub — Environment & Deployment

## Environment Variables

```bash
# Supabase session pooler URL (IPv4-safe)
# Username format: postgres.PROJECT_REF (not just postgres)
# Encode special chars: @ → %40, # → %23, $ → %24
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."         # Settings → API → anon/public key
SUPABASE_SERVICE_ROLE_KEY="..."             # Settings → API → service_role (server-side only)

NEXT_PUBLIC_APP_URL="http://localhost:3000" # Must be full URL — used in tRPC httpBatchLink for SSR
NEXT_PUBLIC_APP_NAME="StrataHub"

RESEND_API_KEY="re_..."                     # Resend dashboard → API Keys
RESEND_FROM_EMAIL="noreply@yourdomain.com"  # Verified sender; fallback: onboarding@resend.dev (free tier)
```

## Local Setup

```bash
cd strata-hub
cp .env.example .env        # fill in all 6+ vars
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev                  # http://localhost:3000
```

Seed account: `admin@stratahub.com.au` / `Admin1234!` (SUPER_ADMIN)

## Useful commands

```bash
npm run build        # type-check + production build
npm run lint         # ESLint
npx prisma db push   # apply schema changes (use this, not migrate dev)
npx prisma generate  # regenerate client after schema changes
npx prisma studio    # Prisma Studio GUI
```

## Vercel Deployment

- **Root directory:** set to `strata-hub`
- **Build command:** default (`npm run build`) — `postinstall: prisma generate` runs automatically
- **Generated client** (`src/generated/prisma`) is gitignored — regenerated on every deploy
- **Add all env vars** in Vercel → Settings → Environment Variables
- After first deploy: update `NEXT_PUBLIC_APP_URL` to the live URL and set same URL as Site URL in Supabase → Auth → URL Configuration
- `/api/auth/callback` must be in Supabase Redirect URLs allowlist

## Production checklist

- [ ] `documents` Supabase Storage bucket exists and is set to **private**
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` added to Vercel env vars
- [ ] Verified sender domain in Resend (or use `onboarding@resend.dev` on free tier)
- [ ] `NEXT_PUBLIC_APP_URL` matches deployed Vercel URL
- [ ] Supabase Site URL + Redirect URLs include deployed URL

## Known Gaps / Deferred Work

- **Automated test coverage** — no tests for auth redirects, building scoping, document delivery, messaging permissions
- **Middleware deprecation** — Next.js 16 prefers `proxy` over `middleware`. Low priority — still functional, just a build warning
- **Analytics trend data** — now implemented (6-month charts); analytics page still uses only real-time data for KPI cards
- **Resend free tier** — 3,000 emails/month, 100/day
