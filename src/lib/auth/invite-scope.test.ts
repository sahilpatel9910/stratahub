import test from "node:test";
import assert from "node:assert/strict";
import { roleCanTargetBuilding, roleRequiresUnit } from "@/lib/auth/invite-scope";

test("roleRequiresUnit is true for resident roles only", () => {
  assert.equal(roleRequiresUnit("OWNER"), true);
  assert.equal(roleRequiresUnit("TENANT"), true);
  assert.equal(roleRequiresUnit("BUILDING_MANAGER"), false);
  assert.equal(roleRequiresUnit("RECEPTION"), false);
  assert.equal(roleRequiresUnit("SUPER_ADMIN"), false);
});

test("roleCanTargetBuilding excludes super admin platform invites", () => {
  assert.equal(roleCanTargetBuilding("SUPER_ADMIN"), false);
  assert.equal(roleCanTargetBuilding("BUILDING_MANAGER"), true);
  assert.equal(roleCanTargetBuilding("OWNER"), true);
});
