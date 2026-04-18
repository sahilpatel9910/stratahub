import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessManagerPath,
  getDefaultDashboardPath,
  getManagerHomePath,
  hasBuildingManagerAccess,
  hasManagerPortalAccess,
  hasReceptionOnlyAccess,
  ROLE_RANK,
} from "@/lib/auth/roles";

test("getDefaultDashboardPath prioritises super admin users", () => {
  assert.equal(
    getDefaultDashboardPath(["OWNER", "SUPER_ADMIN"]),
    "/super-admin/organisations"
  );
});

test("getDefaultDashboardPath routes manager roles to manager portal", () => {
  assert.equal(
    getDefaultDashboardPath(["TENANT", "RECEPTION"]),
    "/manager/visitors"
  );
  assert.equal(
    getDefaultDashboardPath(["BUILDING_MANAGER"]),
    "/manager"
  );
});

test("getDefaultDashboardPath routes resident-only users to resident portal", () => {
  assert.equal(getDefaultDashboardPath(["OWNER"]), "/resident");
  assert.equal(getDefaultDashboardPath(["TENANT"]), "/resident");
});

test("getDefaultDashboardPath routes users without roles to the access required page", () => {
  assert.equal(getDefaultDashboardPath([]), "/access-required");
});

test("hasManagerPortalAccess only allows manager-capable roles", () => {
  assert.equal(hasManagerPortalAccess(["SUPER_ADMIN"]), true);
  assert.equal(hasManagerPortalAccess(["RECEPTION"]), true);
  assert.equal(hasManagerPortalAccess(["OWNER", "TENANT"]), false);
});

test("reception-only access is distinct from building-manager access", () => {
  assert.equal(hasReceptionOnlyAccess(["RECEPTION"]), true);
  assert.equal(hasReceptionOnlyAccess(["RECEPTION", "BUILDING_MANAGER"]), false);
  assert.equal(hasBuildingManagerAccess(["BUILDING_MANAGER"]), true);
  assert.equal(hasBuildingManagerAccess(["RECEPTION"]), false);
});

test("getManagerHomePath sends reception users to visitors", () => {
  assert.equal(getManagerHomePath(["RECEPTION"]), "/manager/visitors");
  assert.equal(getManagerHomePath(["BUILDING_MANAGER"]), "/manager");
});

test("canAccessManagerPath limits reception to operations pages", () => {
  assert.equal(canAccessManagerPath(["RECEPTION"], "/manager/visitors"), true);
  assert.equal(canAccessManagerPath(["RECEPTION"], "/manager/units"), false);
  assert.equal(canAccessManagerPath(["BUILDING_MANAGER"], "/manager/units"), true);
});

test("ROLE_RANK preserves privilege ordering for upgrade-only flows", () => {
  assert.equal(ROLE_RANK.TENANT < ROLE_RANK.OWNER, true);
  assert.equal(ROLE_RANK.OWNER < ROLE_RANK.RECEPTION, true);
  assert.equal(ROLE_RANK.RECEPTION < ROLE_RANK.BUILDING_MANAGER, true);
  assert.equal(ROLE_RANK.BUILDING_MANAGER < ROLE_RANK.SUPER_ADMIN, true);
});
