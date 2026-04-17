import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@/generated/prisma/client";

type AccessRole = "SUPER_ADMIN" | "BUILDING_MANAGER" | "RECEPTION" | "OWNER" | "TENANT";

type AccessUser = {
  id: string;
  orgMemberships: Array<{ role: AccessRole; isActive?: boolean }>;
  buildingAssignments: Array<{ buildingId: string; role: AccessRole; isActive?: boolean }>;
};

const BUILDING_MANAGEMENT_ROLES = new Set<AccessRole>(["SUPER_ADMIN", "BUILDING_MANAGER"]);
const BUILDING_OPERATIONS_ROLES = new Set<AccessRole>(["SUPER_ADMIN", "BUILDING_MANAGER", "RECEPTION"]);

export function isSuperAdmin(user: AccessUser) {
  return user.orgMemberships.some(
    (membership) => membership.role === "SUPER_ADMIN" && membership.isActive !== false
  );
}

export function hasBuildingManagementAccess(user: AccessUser, buildingId: string) {
  return (
    isSuperAdmin(user) ||
    user.buildingAssignments.some(
      (assignment) =>
        assignment.buildingId === buildingId &&
        assignment.isActive !== false &&
        BUILDING_MANAGEMENT_ROLES.has(assignment.role)
    )
  );
}

export function hasBuildingOperationsAccess(user: AccessUser, buildingId: string) {
  return (
    isSuperAdmin(user) ||
    user.buildingAssignments.some(
      (assignment) =>
        assignment.buildingId === buildingId &&
        assignment.isActive !== false &&
        BUILDING_OPERATIONS_ROLES.has(assignment.role)
    )
  );
}

async function hasResidentBuildingAccess(
  db: PrismaClient,
  userId: string,
  buildingId: string
) {
  const [ownershipCount, tenancyCount] = await Promise.all([
    db.ownership.count({
      where: {
        userId,
        isActive: true,
        unit: { buildingId },
      },
    }),
    db.tenancy.count({
      where: {
        userId,
        isActive: true,
        unit: { buildingId },
      },
    }),
  ]);

  return ownershipCount > 0 || tenancyCount > 0;
}

export async function hasBuildingAccess(
  db: PrismaClient,
  user: AccessUser,
  buildingId: string
) {
  if (isSuperAdmin(user)) {
    return true;
  }

  if (
    user.buildingAssignments.some(
      (assignment) =>
        assignment.buildingId === buildingId && assignment.isActive !== false
    )
  ) {
    return true;
  }

  return hasResidentBuildingAccess(db, user.id, buildingId);
}

export async function assertBuildingAccess(
  db: PrismaClient,
  user: AccessUser,
  buildingId: string
) {
  if (!(await hasBuildingAccess(db, user, buildingId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this building.",
    });
  }
}

export async function assertBuildingManagementAccess(
  db: PrismaClient,
  user: AccessUser,
  buildingId: string
) {
  if (!hasBuildingManagementAccess(user, buildingId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage this building.",
    });
  }
}

export async function assertBuildingOperationsAccess(
  db: PrismaClient,
  user: AccessUser,
  buildingId: string
) {
  if (!hasBuildingOperationsAccess(user, buildingId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to operate in this building.",
    });
  }
}
