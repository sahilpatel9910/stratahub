@AGENTS.md

# StrataHub — Claude Code Context

> **Last updated: 2026-04-17** — Phase 3 active on `feat/phase3-features`.

## Project Overview

Australian strata/apartment property management SaaS for building managers, reception, owners, tenants, and super-admins.
Live: `stratahub-six.vercel.app`

## Tech Stack

- Next.js 16 App Router
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui via `@base-ui/react` (not Radix)
- Supabase Auth SSR via `@supabase/ssr`
- PostgreSQL + Prisma 7 (`src/generated/prisma`)
- tRPC v11 + TanStack Query v5 + SuperJSON
- Zustand v5 for building context
- Resend v6

## Critical Patterns

- Prisma 7: never call `new PrismaClient()` without the `PrismaPg` adapter from `src/server/db/client.ts`.
- Prisma config lives in `prisma.config.ts`; use `npx prisma db push`, not `migrate dev`.
- Prisma imports come from `@/generated/prisma/client`.
- Base UI: no `asChild`; use `render={<Component />}`.
- Base UI `Select` can emit `null` from `onValueChange`; always guard it.

## Current Phase

Branch: `feat/phase3-features`

Completed in Phase 3:
- ✅ Analytics 6-month trend charts via `buildings.getTrends`
- ✅ "Deactivate User" rename
- ✅ `/api/auth/signout` open redirect fix
- ✅ Resident docs/announcements fallback fix
- ✅ Invite lifecycle now uses `revokedAt` instead of hard deletes, with resend support and status/history UI
- ✅ Super-admin UI can now invite other `SUPER_ADMIN` users
- ✅ Resident invites are unit-scoped; owner accepts create ownership and tenant accepts create tenancy placeholders
- ✅ `RECEPTION` is now separated from `BUILDING_MANAGER`: reception is operations-only, managers keep admin/control workflows
- ✅ Rent now includes a “Complete Tenant Setup” flow for invite-created tenancy placeholders
- ✅ Auth redirect decisions extracted into `src/lib/auth/redirects.ts` with tests
- ✅ Next.js warning cleanup: `src/proxy.ts` replaces `src/middleware.ts`, and `next.config.ts` sets `turbopack.root`

Next priorities:
- Live invite-only E2E verification against Supabase email flow
- Route/API coverage for invite acceptance behavior
- Manual Supabase hardening: disable open signup in dashboard

## Quick Start

```bash
cd strata-hub
npx prisma generate
npx prisma db push
npm run dev
```

Seed account: `admin@stratahub.com.au` / `Admin1234!` (SUPER_ADMIN)

## Reference Docs

Read only the relevant doc:
- `docs/context/routers.md` — tRPC procedure inputs/outputs and API routes
- `docs/context/schema.md` — data model and field names
- `docs/context/auth.md` — invite-only auth flow, redirects, proxy behavior
- `docs/context/structure.md` — project layout and routing map
- `docs/context/architecture.md` — app patterns like `skipToken` and building auth
- `docs/context/deployment.md` — env vars, Vercel, production checklist
- `docs/supabase-security.md` — security model, RLS posture, storage setup
