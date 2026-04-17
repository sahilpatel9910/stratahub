export type InvitationLike = {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt?: Date | null;
};

export type InvitationStatus =
  | "missing"
  | "accepted"
  | "revoked"
  | "expired"
  | "pending";

export const INVITATION_STATUS_LABELS: Record<Exclude<InvitationStatus, "missing">, string> = {
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
  pending: "Pending",
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailsMatch(a?: string | null, b?: string | null) {
  if (!a || !b) {
    return false;
  }

  return normalizeEmail(a) === normalizeEmail(b);
}

export function getInvitationStatus(
  invite: InvitationLike | null | undefined,
  now = new Date()
): InvitationStatus {
  if (!invite) {
    return "missing";
  }

  if (invite.acceptedAt) {
    return "accepted";
  }

  if (invite.revokedAt) {
    return "revoked";
  }

  if (invite.expiresAt < now) {
    return "expired";
  }

  return "pending";
}
