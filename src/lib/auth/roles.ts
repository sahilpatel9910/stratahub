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

export const RECEPTION_ALLOWED_PATHS = [
  "/manager",
  "/manager/maintenance",
  "/manager/visitors",
  "/manager/parcels",
  "/manager/keys",
  "/manager/messages",
  "/manager/settings",
] as const;

export function hasManagerPortalAccess(roles: readonly UserRole[]) {
  return roles.some((role) => MANAGER_PORTAL_ROLES.includes(role));
}

export function hasBuildingManagerAccess(roles: readonly UserRole[]) {
  return roles.includes("SUPER_ADMIN") || roles.includes("BUILDING_MANAGER");
}

export function hasReceptionOnlyAccess(roles: readonly UserRole[]) {
  return roles.includes("RECEPTION") && !hasBuildingManagerAccess(roles);
}

export function getManagerHomePath(roles: readonly UserRole[]) {
  return hasReceptionOnlyAccess(roles) ? "/manager/visitors" : "/manager";
}

export function canAccessManagerPath(
  roles: readonly UserRole[],
  pathname: string
) {
  if (!hasManagerPortalAccess(roles)) {
    return false;
  }

  if (!hasReceptionOnlyAccess(roles)) {
    return pathname.startsWith("/manager");
  }

  return RECEPTION_ALLOWED_PATHS.includes(
    pathname as (typeof RECEPTION_ALLOWED_PATHS)[number]
  );
}

export function getDefaultDashboardPath(roles: readonly UserRole[]) {
  if (roles.includes("SUPER_ADMIN")) {
    return "/super-admin/organisations" as const;
  }

  if (hasManagerPortalAccess(roles)) {
    return getManagerHomePath(roles);
  }

  if (roles.includes("OWNER") || roles.includes("TENANT")) {
    return "/resident" as const;
  }

  return "/access-required" as const;
}
