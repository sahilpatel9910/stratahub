import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthPageRedirectPath,
  getRootRedirectPath,
  isPublicAuthPath,
} from "@/lib/auth/redirects";

test("getRootRedirectPath sends signed-out visitors to login", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: false,
      hasAppUser: false,
      roles: [],
    }),
    "/login"
  );
});

test("getRootRedirectPath resumes pending invites before access-required", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: false,
      pendingInviteToken: "invite-123",
      roles: [],
    }),
    "/invite/invite-123"
  );
});

test("getRootRedirectPath routes signed-in users without app access to access-required", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: false,
      roles: [],
    }),
    "/access-required"
  );
});

test("getRootRedirectPath prioritises pending invites for users with no active roles", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: true,
      pendingInviteToken: "invite-456",
      roles: [],
    }),
    "/invite/invite-456"
  );
});

test("getRootRedirectPath falls back to the default dashboard when no invite is pending", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: true,
      roles: [],
    }),
    "/access-required"
  );
});

test("getRootRedirectPath uses role-based redirects for active users", () => {
  assert.equal(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: true,
      roles: ["BUILDING_MANAGER"],
    }),
    "/manager"
  );
});

test("isPublicAuthPath allows invite and auth callback routes", () => {
  assert.equal(isPublicAuthPath("/invite/token-1"), true);
  assert.equal(isPublicAuthPath("/api/auth/callback"), true);
});

test("isPublicAuthPath keeps dashboard routes protected", () => {
  assert.equal(isPublicAuthPath("/manager"), false);
  assert.equal(isPublicAuthPath("/super-admin/users"), false);
});

test("getAuthPageRedirectPath returns invite pages for authenticated invite registrations", () => {
  assert.equal(getAuthPageRedirectPath("/register", "invite-789"), "/invite/invite-789");
});

test("getAuthPageRedirectPath sends other authenticated auth-page visits home", () => {
  assert.equal(getAuthPageRedirectPath("/login"), "/");
});
