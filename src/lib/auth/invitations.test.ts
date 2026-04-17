import test from "node:test";
import assert from "node:assert/strict";
import {
  emailsMatch,
  getInvitationStatus,
  normalizeEmail,
} from "@/lib/auth/invitations";

test("normalizeEmail trims and lowercases email addresses", () => {
  assert.equal(normalizeEmail("  Resident@Example.COM "), "resident@example.com");
});

test("emailsMatch compares emails case-insensitively", () => {
  assert.equal(emailsMatch("Resident@Example.COM", "resident@example.com"), true);
  assert.equal(emailsMatch("resident@example.com", "other@example.com"), false);
});

test("getInvitationStatus returns missing for absent invites", () => {
  assert.equal(getInvitationStatus(null), "missing");
});

test("getInvitationStatus returns accepted when acceptedAt is present", () => {
  assert.equal(
    getInvitationStatus({
      acceptedAt: new Date("2026-04-15T10:00:00Z"),
      expiresAt: new Date("2026-04-22T10:00:00Z"),
    }),
    "accepted"
  );
});

test("getInvitationStatus returns revoked when revokedAt is present", () => {
  assert.equal(
    getInvitationStatus({
      acceptedAt: null,
      revokedAt: new Date("2026-04-15T11:00:00Z"),
      expiresAt: new Date("2026-04-22T10:00:00Z"),
    }),
    "revoked"
  );
});

test("getInvitationStatus returns expired when the expiry date has passed", () => {
  assert.equal(
    getInvitationStatus(
      {
        acceptedAt: null,
        expiresAt: new Date("2026-04-14T10:00:00Z"),
      },
      new Date("2026-04-15T10:00:00Z")
    ),
    "expired"
  );
});

test("getInvitationStatus returns pending for valid unaccepted invites", () => {
  assert.equal(
    getInvitationStatus(
      {
        acceptedAt: null,
        expiresAt: new Date("2026-04-16T10:00:00Z"),
      },
      new Date("2026-04-15T10:00:00Z")
    ),
    "pending"
  );
});
