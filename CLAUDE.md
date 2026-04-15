@AGENTS.md

# StrataHub — Claude Code Context

> **Last updated: 2026-04-16** — Phase 3 active on `feat/phase3-features`. Phase 1 (UI stabilization) and Phase 2 (verification + security hardening) are complete.

## Project Overview

Australian strata/apartment property management SaaS. Users: building managers, reception, property owners, tenants, super-admins.

Live: `stratahub-six.vercel.app`

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui via `@base-ui/react` (**NOT** `@radix-ui`) |
| Auth | Supabase Auth (SSR via `@supabase/ssr`) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 7 — output → `src/generated/prisma` |
| API Layer | tRPC v11 + TanStack Query v5 + SuperJSON |
| State | Zustand v5 (building context only) |
| Email | Resend v6 |
| Charts | Recharts v3 |
| Package Manager | npm |

---

## CRITICAL: Prisma 7 Patterns

`new PrismaClient()` with no args is a **type error**. Always use driver adapter:

```ts
// src/server/db/client.ts
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
return new PrismaClient({ adapter });
```

`prisma.config.ts` holds the DB URL (not `schema.prisma`). Always use **`npx prisma db push`** (not `migrate dev`) — schema was bootstrapped with `db push`.

All Prisma imports come from `@/generated/prisma/client` (note the `/client` suffix).

---

## CRITICAL: Base UI Patterns

shadcn uses `@base-ui/react` — two breaking differences from Radix:

### 1. No `asChild` — use `render` prop
```tsx
// ❌ Wrong
<DialogTrigger asChild><Button>New</Button></DialogTrigger>

// ✅ Correct
<DialogTrigger render={<Button />}>New</DialogTrigger>
<Button render={<Link href="/register" />}>Create Account</Button>
```

### 2. Select `onValueChange` receives `null`
```tsx
// ✅ Always guard
<Select onValueChange={(v) => v !== null && setFormStatus(v)}>
```

---

## Current Phase — Phase 3: New Features (`feat/phase3-features`)

**Branch:** `feat/phase3-features` (off `main`)

**Completed this phase so far:**
- ✅ 6-month trend charts in Analytics (`buildings.getTrends` tRPC procedure)
- ✅ Renamed "Remove from All Buildings" → "Deactivate User"
- ✅ Fixed open redirect in `/api/auth/signout`
- ✅ Fixed `getMyDocuments` + `getMyAnnouncements` missing `buildingAssignment` fallback

**Next priorities (decide with user):**
- New feature development (resident improvements, manager workflow, financial features, etc.)
- Test coverage for high-risk paths

---

## Quick Start

```bash
cd strata-hub && npm run dev   # http://localhost:3000
```

Seed account: `admin@stratahub.com.au` / `Admin1234!` (SUPER_ADMIN)

---

## Reference Docs

Read these files **when you need them** — do not load all at once:

| File | When to read |
|---|---|
| `docs/context/routers.md` | Looking up tRPC procedure inputs/outputs or API routes |
| `docs/context/schema.md` | Understanding data model, relationships, field names |
| `docs/context/auth.md` | Auth flow, invite-only registration, role redirects |
| `docs/context/structure.md` | Project directory layout, routing map |
| `docs/context/architecture.md` | Architectural decisions, skipToken pattern, building-auth pattern |
| `docs/context/deployment.md` | Env vars, Vercel setup, production checklist |
| `docs/supabase-security.md` | Security model, RLS posture, storage bucket setup |
