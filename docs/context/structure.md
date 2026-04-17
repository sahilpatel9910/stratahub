# StrataHub — Project Structure & Routing

## Directory Layout

```
strata-hub/
├── prisma/
│   ├── schema.prisma           # Full data model — source of truth
│   └── seed.ts                 # Creates super-admin + demo org/building
├── prisma.config.ts            # Prisma 7 config: connection URL for migrations
├── docs/
│   ├── context/                # Reference docs (routers, schema, auth, etc.)
│   └── supabase-security.md   # Security model + RLS posture
└── src/
    ├── app/
    │   ├── (auth)/             # Public auth pages (no sidebar)
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── register/
    │   │   │   ├── page.tsx         # Invite-only: redirects if no ?invite= token
    │   │   │   └── register-form.tsx
    │   │   └── forgot-password/page.tsx
    │   ├── (dashboard)/        # Protected pages (sidebar + topbar)
    │   │   ├── layout.tsx           # Thin wrapper: TRPCProvider + SidebarProvider + Toaster
    │   │   ├── manager/             # Shared manager portal shell; reception is route-limited inside it
    │   │   │   ├── layout.tsx       # AppSidebar + Topbar (with building switcher) + role-aware route guard
    │   │   │   ├── page.tsx         # Dashboard
    │   │   │   ├── residents/  units/  rent/  keys/  maintenance/
    │   │   │   ├── visitors/   parcels/  announcements/  documents/
    │   │   │   ├── messages/   strata/  financials/  analytics/
    │   │   │   └── settings/
    │   │   ├── resident/            # Resident self-service portal
    │   │   │   ├── layout.tsx       # ResidentSidebar + Topbar (no building switcher by default)
    │   │   │   ├── page.tsx         # Dashboard
    │   │   │   ├── levies/  maintenance/  documents/  announcements/
    │   │   └── super-admin/
    │   │       ├── organisations/  buildings/  users/   # users includes super-admin invites + unit-scoped resident invites
    │   ├── api/
    │   │   ├── auth/callback/route.ts
    │   │   ├── auth/signout/route.ts
    │   │   ├── invite/[token]/route.ts
    │   │   ├── invite/accept/route.ts
    │   │   ├── storage/upload-url/route.ts
    │   │   ├── storage/delete/route.ts
    │   │   └── trpc/[trpc]/route.ts
    │   ├── access-required/page.tsx # Shown to authenticated users with no active role
    │   ├── invite/[token]/          # Public invite page
    │   │   ├── page.tsx
    │   │   └── accept-invite-button.tsx
    │   └── page.tsx            # Root → role-based redirect
    ├── components/
    │   ├── layout/
    │   │   ├── app-sidebar.tsx
    │   │   ├── resident-sidebar.tsx
    │   │   ├── building-switcher.tsx
    │   │   └── topbar.tsx      # Polls notifications.unreadCount every 30s
    │   └── ui/                 # shadcn/ui components (never edit directly)
    ├── hooks/
    │   ├── use-building-context.ts  # Zustand building selector
    │   └── use-mobile.ts
    ├── lib/
    │   ├── auth/
    │   │   ├── roles.ts        # ROLE_RANK, getDefaultDashboardPath
    │   │   ├── invitations.ts  # getInvitationStatus, emailsMatch, normalizeEmail
    │   │   └── redirects.ts    # pure helpers for root/proxy auth redirects
    │   ├── constants.ts        # formatCurrency, USER_ROLE_LABELS, AUSTRALIAN_STATES, etc.
    │   ├── email/
    │   │   ├── resend.ts       # Lazy Resend client — getResend()
    │   │   └── send.ts         # sendLevyNoticeEmail, sendMaintenanceUpdateEmail, sendWelcomeInviteEmail
    │   ├── supabase/
    │   │   ├── client.ts       # createBrowserClient
    │   │   ├── server.ts       # createServerClient with cookie handlers
    │   │   └── middleware.ts   # updateSession() used by src/proxy.ts
    │   └── trpc/
    │       ├── client.ts       # trpc = createTRPCReact<AppRouter>()
    │       └── provider.tsx    # TRPCProvider: QueryClient + httpBatchLink + superjson
    ├── proxy.ts                 # Next.js 16 entry — calls updateSession()
    ├── server/
    │   ├── auth/
    │   │   ├── building-access.ts   # assertBuildingAccess, assertBuildingManagementAccess
    │   │   └── invitations.ts       # findPendingInvitationByEmail (server-side)
    │   ├── db/client.ts        # Prisma singleton with PrismaPg adapter
    │   └── trpc/
    │       ├── trpc.ts         # Context, procedure factories, role guards
    │       ├── router.ts       # AppRouter — combines all sub-routers
    │       ├── lib/create-notification.ts
    │       └── routers/        # 17 domain routers
    └── types/auth.ts
```

## Routing

### Manager routes (`/manager/**`)
All require manager portal access plus building context.
- `/manager` — dashboard stats + maintenance + announcements
- `/manager/residents` — resident roster
- `/manager/units` — unit list + create
- `/manager/rent` — rent roll + payment recording + pending tenant setup completion
- `/manager/keys` — key records
- `/manager/maintenance` — request list + status updates
- `/manager/visitors` — visitor log
- `/manager/parcels` — parcel tracking
- `/manager/announcements` — building announcements
- `/manager/documents` — file upload + listing
- `/manager/messages` — messaging threads
- `/manager/strata` — strata info, levies, meetings
- `/manager/financials` — income/expense records
- `/manager/analytics` — KPI cards + 6-month trend charts
- `/manager/settings` — profile + password + roles

Reception-only allowed subset:
- `/manager`
- `/manager/maintenance`
- `/manager/visitors`
- `/manager/parcels`
- `/manager/keys`
- `/manager/messages`
- `/manager/settings`

### Resident routes (`/resident/**`)
Uses `ResidentSidebar`. Data scoped to user's own units — no building switcher (unless multi-building owner).
- `/resident` — dashboard
- `/resident/levies` — read-only levy history
- `/resident/maintenance` — submit + track requests
- `/resident/documents` — public building documents
- `/resident/announcements` — non-expired announcements

### Super-admin routes (`/super-admin/**`)
- `/super-admin/organisations`
- `/super-admin/buildings`
- `/super-admin/users` — user roster plus invite history, resend, revoke, status tracking, and super-admin/resident invite management
