 # StrataHub

StrataHub is an Australian strata and apartment management SaaS built with Next.js, Supabase, Prisma, and tRPC. It supports property managers, residents, and super-admin users across multiple organisations and buildings.

## What It Does

- Manager dashboard for residents, units, rent, maintenance, visitors, parcels, keys, announcements, documents, messaging, strata records, financials, and analytics
- Resident portal for announcements, maintenance requests, levy history, and document access
- Organisation and building management for super-admin users
- Invite-based onboarding flow backed by Supabase Auth and Prisma user records
- Email notifications via Resend

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui backed by `@base-ui/react`
- Supabase Auth + Storage
- PostgreSQL + Prisma 7
- tRPC v11 + TanStack Query v5
- Zustand for building context

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required variables:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=StrataHub
```

### 3. Prepare the database

Run your Prisma migrations, then seed the demo data if needed:

```bash
npx prisma migrate dev
npm run db:seed
```

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev` starts the local development server
- `npm run build` builds the production app
- `npm run start` runs the production build locally
- `npm run lint` runs ESLint
- `npm run db:seed` seeds demo data

## Authentication Model

StrataHub uses two linked user records:

- Supabase `auth.users` for authentication
- Prisma `users` for application data and role/membership logic

On signup or first verified login, the app ensures the Prisma user exists and links it through `supabaseAuthId`.

## Security Notes

- Building-scoped access is enforced server-side through shared authorization helpers
- Supabase Storage document uploads use signed upload URLs
- The `documents` storage bucket should be private
- Document downloads now use short-lived signed URLs created after authorization checks
- New building-scoped features should follow the access patterns documented in [`docs/supabase-security.md`](./docs/supabase-security.md)

## Project Structure

```text
strata-hub/
├── prisma/                 # Prisma schema, migrations, and seed script
├── docs/                   # Project docs, including security guidance
├── src/app/                # App Router routes
├── src/components/         # UI and layout components
├── src/lib/                # Shared utilities, email, Supabase, tRPC client
├── src/server/             # Prisma client and tRPC server routers
└── src/generated/prisma/   # Generated Prisma client output
```

## Important Implementation Notes

- Prisma 7 is configured through `prisma.config.ts`
- Prisma imports should come from `@/generated/prisma/client`
- shadcn components in this repo use Base UI patterns, so `render` is used instead of Radix `asChild`
- Supabase service-role actions are limited to server-side routes only

## Related Docs

- [`CLAUDE.md`](./CLAUDE.md) for detailed architecture and implementation notes
- [`docs/supabase-security.md`](./docs/supabase-security.md) for security and storage guidance
