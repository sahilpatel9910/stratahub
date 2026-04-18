import type { UserRole } from "@/generated/prisma/client";

export function roleRequiresUnit(role: UserRole) {
  return role === "OWNER" || role === "TENANT";
}

export function roleCanTargetBuilding(role: UserRole) {
  return role !== "SUPER_ADMIN";
}
