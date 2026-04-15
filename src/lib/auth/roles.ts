import type { UserRole } from "@/generated/prisma/client";

export const ROLE_RANK: Record<UserRole, number> = {
  TENANT: 0,
  OWNER: 1,
  RECEPTION: 2,
  BUILDING_MANAGER: 3,
  SUPER_ADMIN: 4,
};

export const MANAGER_PORTAL_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "BUILDING_MANAGER",
  "RECEPTION",
];

export function hasManagerPortalAccess(roles: readonly UserRole[]) {
  return roles.some((role) => MANAGER_PORTAL_ROLES.includes(role));
}

export function getDefaultDashboardPath(roles: readonly UserRole[]) {
  if (roles.includes("SUPER_ADMIN")) {
    return "/super-admin/organisations" as const;
  }

  if (hasManagerPortalAccess(roles)) {
    return "/manager" as const;
  }

  if (roles.includes("OWNER") || roles.includes("TENANT")) {
    return "/resident" as const;
  }

  return "/access-required" as const;
}
