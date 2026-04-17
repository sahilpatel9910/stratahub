import { getDefaultDashboardPath } from "@/lib/auth/roles";
import type { UserRole } from "@/generated/prisma/client";

type RootRedirectArgs = {
  hasAuthUser: boolean;
  hasAppUser: boolean;
  pendingInviteToken?: string | null;
  roles: UserRole[];
};

export function getRootRedirectPath({
  hasAuthUser,
  hasAppUser,
  pendingInviteToken,
  roles,
}: RootRedirectArgs) {
  if (!hasAuthUser) {
    return "/login";
  }

  if (!hasAppUser) {
    return pendingInviteToken ? `/invite/${pendingInviteToken}` : "/access-required";
  }

  if (roles.length === 0 && pendingInviteToken) {
    return `/invite/${pendingInviteToken}`;
  }

  return getDefaultDashboardPath(roles);
}

export function isPublicAuthPath(pathname: string) {
  return (
    ["/", "/login", "/register", "/forgot-password", "/reset-password"].includes(pathname) ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/auth/")
  );
}

export function getAuthPageRedirectPath(pathname: string, inviteToken?: string | null) {
  if (pathname === "/register" && inviteToken) {
    return `/invite/${inviteToken}`;
  }

  return "/";
}
