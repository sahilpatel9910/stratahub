# Supabase Security Notes

## Why the RLS warning appears

Supabase warns when tables in exposed schemas like `public` do not have Row Level Security enabled. In this project, app data lives in `public`, so the warning is expected until RLS is explicitly enabled.

## Current security model

- Supabase Auth handles sign-in, sessions, and cookie refresh.
- Prisma uses `DATABASE_URL` for server-side queries and is not governed by Supabase PostgREST RLS.
- Building-scoped application access is enforced in the app layer through tRPC and API authorization checks.
- Supabase Storage uses the service role key only inside trusted server code after authorization passes.

## RLS baseline

Run [supabase/rls-lockdown.sql](/Users/sahil/Desktop/calude code vs/Project 1/strata-hub/supabase/rls-lockdown.sql) in the Supabase SQL Editor.

This is safe here because the app does not use the browser Supabase client for direct business-table access.

## Document storage model

- The `documents` bucket should be **private**.
- Uploads still use signed upload URLs issued by trusted server code.
- Reads happen through short-lived signed download URLs generated only after server-side authorization.
- `storagePath` is the canonical document locator. Long-lived public URLs should not be treated as an access mechanism.

## Safe pattern for new building-scoped features

When adding a new building-scoped tRPC procedure or API route:

1. Authenticate the caller.
2. Resolve the target building directly or through the target record.
3. Require building access for read-like operations.
4. Require building management access for write/delete/admin operations.
5. Only then query or mutate the Prisma record or Supabase Storage object.
