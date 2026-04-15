export type InvitationLike = {
  acceptedAt: Date | null;
  expiresAt: Date;
};

export type InvitationStatus =
  | "missing"
  | "accepted"
  | "expired"
  | "pending";

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

  if (invite.expiresAt < now) {
    return "expired";
  }

  return "pending";
}
