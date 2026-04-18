@AGENTS.md

# StrataHub — Agent Context
Australian strata management SaaS. Live: `stratahub-six.vercel.app`
Stack: Next.js 16 App Router · TS 5 · Tailwind v4 · tRPC v11 · TanStack Query v5 · Prisma 7 · Supabase Auth/Storage · Zustand v5 · Resend v6 · Recharts v3 · Sonner · Lucide

## Critical Gotchas

**Prisma 7** — `new PrismaClient()` is a type error. Must pass `PrismaPg` adapter (see `src/server/db/client.ts`).
- URL lives in `prisma.config.ts`, NOT in `schema.prisma` datasource block
- All imports: `from "@/generated/prisma/client"` (note `/client` suffix)
- Schema changes: `npx prisma db push` then `npx prisma generate` — never `migrate dev`

**Base UI** — shadcn uses `@base-ui/react`, not `@radix-ui`. Two breaking differences:
```tsx
// ❌ asChild doesn't exist      ✅ use render prop
<DialogTrigger render={<Button />}>Open</DialogTrigger>
// ❌ onValueChange={setState}   ✅ guard against null
<Select onValueChange={(v) => v !== null && setState(v)}>
```

**Auth** — Two records: Supabase `auth.users` (UUID) + Prisma `users` (linked via `supabaseAuthId`).
Prisma user created inside `POST /api/invite/accept`, not at signup.

**Building auth** — Never trust caller-supplied `buildingId`. Resolve building from target record, then call:
- `assertBuildingOperationsAccess` → RECEPTION+ (parcels, visitors, maintenance, strata reads)
- `assertBuildingManagementAccess` → BUILDING_MANAGER+ (residents, rent, financials, document writes)

**Money** — All values stored as cents (integers). Always `formatCurrency(cents)` from `src/lib/constants.ts`.

**Parcel gotcha** — Model uses `loggedAt`, not `createdAt`.

**`parcels.create` notification** — Matches residents by `unitNumber` string, not FK. Must match exactly.

**Maintenance images** — `MaintenanceImage.imageUrl` stores the storagePath (not a public URL). Signed display URLs generated in `getById` via `adminClient.storage.createSignedUrls()` → returned as `image.displayUrl`.

**Bond router** — `lodgementAuthority` derived server-side from `state` (clients cannot override). Deadline calculated from `tenancy.moveInDate ?? tenancy.createdAt`, not lodgement date.

**`generateSchedule`** — Throws `BAD_REQUEST` if payments already exist. No idempotent retry.

**`skipToken`** — Use for conditional queries, never `enabled: false`:
```ts
trpc.foo.useQuery(selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken)
```

**Visitor date filter** — Filters on `arrivalTime` (with `createdAt` fallback for pre-registered visitors).

**Supabase Storage buckets** — Both exist, both private:
- `documents` — building docs (any MIME, no size limit)
- `maintenance` — maintenance images (images only, 10 MB limit)

**Fire-and-forget pattern** — Emails + notifications: `void promise.catch(err => console.error(...))`. Primary mutation always succeeds.

**Resend fallback** — `getResend()` lazy-init; uses `"re_placeholder"` if `RESEND_API_KEY` unset (prevents build crash).

## Commands
```bash
npm run dev                # localhost:3000
npm run build              # type-check + build
npx prisma db push         # apply schema changes
npx prisma generate        # regen client after schema change
npm run db:seed            # seed super-admin + demo org/building (once)
```
Seed: `admin@stratahub.com.au` / `Admin1234!` (SUPER_ADMIN, Harbour View Apartments)

## Current Phase — Active work on main

### ✅ Completed
- Branches 1–5: resident messaging, notification completeness, maintenance images, bond tracking, strata bylaws
- `strata.getByBuilding` + `listLevies` downgraded to `managerProcedure` (RECEPTION can now read)
- `documents.listByBuilding` fixed to `assertBuildingOperationsAccess` (was silently 403ing RECEPTION)
- `generateSchedule` duplicate guard added
- `createManagerInvite` now fires INVITE_SENT in-app notification for existing users
- Visitor date filter corrected to `arrivalTime`
- `getRentRoll` now returns `tenancyId` + `moveInDate`
- `strata.createBylaw` / `updateBylaw` / `deleteBylaw` procedures + full CRUD Bylaws tab

### ⬜ Next
- Branch 6: `feat/common-areas` — CommonArea + booking router + UI
- E2E invite flow verification against live Supabase email
- Disable open signup in Supabase dashboard

## Reference Docs
Read only what you need:
- `docs/context/routers.md` — all tRPC procedures + API routes
- `docs/context/schema.md` — data model, field notes
- `docs/context/auth.md` — invite flow, redirects, proxy, RECEPTION/MANAGER split
- `docs/context/architecture.md` — patterns (skipToken, building auth, upload flow)
- `docs/context/structure.md` — file layout + routing map
- `docs/context/deployment.md` — env vars, Vercel setup, production checklist
- `PLAN.md` — branch-by-branch roadmap with ✅/⬜ status
