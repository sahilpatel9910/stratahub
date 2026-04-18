import test from "node:test";
import assert from "node:assert/strict";
import {
  hasBuildingOperationsAccess,
  hasBuildingManagementAccess,
  isSuperAdmin,
} from "@/server/auth/building-access";

test("isSuperAdmin only returns true for active super admin memberships", () => {
  assert.equal(
    isSuperAdmin({
      id: "user-1",
      orgMemberships: [{ role: "SUPER_ADMIN", isActive: true }],
      buildingAssignments: [],
    }),
    true
  );

  assert.equal(
    isSuperAdmin({
      id: "user-1",
      orgMemberships: [{ role: "SUPER_ADMIN", isActive: false }],
      buildingAssignments: [],
    }),
    false
  );
});

test("hasBuildingManagementAccess allows active manager assignments", () => {
  const user = {
    id: "user-1",
    orgMemberships: [],
    buildingAssignments: [
      { buildingId: "b-1", role: "BUILDING_MANAGER" as const, isActive: true },
    ],
  };

  assert.equal(hasBuildingManagementAccess(user, "b-1"), true);
  assert.equal(hasBuildingManagementAccess(user, "b-2"), false);
});

test("hasBuildingManagementAccess denies resident assignments", () => {
  const user = {
    id: "user-1",
    orgMemberships: [],
    buildingAssignments: [
      { buildingId: "b-1", role: "OWNER" as const, isActive: true },
    ],
  };

  assert.equal(hasBuildingManagementAccess(user, "b-1"), false);
});

test("hasBuildingManagementAccess denies reception assignments", () => {
  const user = {
    id: "user-1",
    orgMemberships: [],
    buildingAssignments: [
      { buildingId: "b-1", role: "RECEPTION" as const, isActive: true },
    ],
  };

  assert.equal(hasBuildingManagementAccess(user, "b-1"), false);
  assert.equal(hasBuildingOperationsAccess(user, "b-1"), true);
});

test("hasBuildingManagementAccess allows super admins without a building assignment", () => {
  const user = {
    id: "user-1",
    orgMemberships: [{ role: "SUPER_ADMIN" as const, isActive: true }],
    buildingAssignments: [],
  };

  assert.equal(hasBuildingManagementAccess(user, "b-1"), true);
});
