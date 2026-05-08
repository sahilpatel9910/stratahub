import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { findPendingInvitationByEmail } from "@/server/auth/invitations";
import { getRootRedirectPath } from "@/lib/auth/redirects";
import type { UserRole } from "@/generated/prisma/client";

function getPrimaryRole(roles: UserRole[]): UserRole | null {
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('BUILDING_MANAGER')) return 'BUILDING_MANAGER';
  if (roles.includes('RECEPTION')) return 'RECEPTION';
  if (roles.includes('OWNER')) return 'OWNER';
  if (roles.includes('TENANT')) return 'TENANT';
  return null;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect(
      getRootRedirectPath({
        hasAuthUser: false,
        hasAppUser: false,
        roles: [],
      })
    );
  }

  // Fast path: use cached role from user metadata (avoids DB round-trip on warm sessions)
  const VALID_ROLES = new Set<string>(['SUPER_ADMIN', 'BUILDING_MANAGER', 'RECEPTION', 'OWNER', 'TENANT']);
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  const cachedRole = authUser.user_metadata?.primaryRole as string | undefined;
  const cachedAt = authUser.user_metadata?.primaryRoleCachedAt as number | undefined;

  if (
    typeof cachedRole === 'string' &&
    VALID_ROLES.has(cachedRole) &&
    typeof cachedAt === 'number' &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    redirect(
      getRootRedirectPath({
        hasAuthUser: true,
        hasAppUser: true,
        roles: [cachedRole as UserRole],
      })
    );
  }

  // Slow path: full DB lookup (first login, or metadata not yet set)
  const dbUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    include: {
      orgMemberships: { where: { isActive: true }, select: { role: true } },
      buildingAssignments: { where: { isActive: true }, select: { role: true } },
    },
  });

  if (!dbUser) {
    const pendingInvite = authUser.email
      ? await findPendingInvitationByEmail(authUser.email)
      : null;

    redirect(
      getRootRedirectPath({
        hasAuthUser: true,
        hasAppUser: false,
        pendingInviteToken: pendingInvite?.token,
        roles: [],
      })
    );
  }

  const roles = [
    ...dbUser.orgMemberships.map((m) => m.role),
    ...dbUser.buildingAssignments.map((a) => a.role),
  ];

  // Cache role in metadata for next visit.
  // void = fire-and-forget: we don't block the redirect on this write.
  // The cache miss on the next request is acceptable; correctness is preserved by the TTL.
  const primaryRole = getPrimaryRole(roles);
  if (primaryRole) {
    void supabase.auth.updateUser({ data: { primaryRole, primaryRoleCachedAt: Date.now() } });
  }

  const pendingInvite = roles.length === 0
    ? await findPendingInvitationByEmail(dbUser.email)
    : null;

  redirect(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: true,
      pendingInviteToken: pendingInvite?.token,
      roles,
    })
  );
}
