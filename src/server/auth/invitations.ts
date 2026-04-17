import { db } from "@/server/db/client";
import { getInvitationStatus, normalizeEmail } from "@/lib/auth/invitations";

export async function findInvitationByToken(token: string) {
  return db.invitation.findUnique({
    where: { token },
  });
}

export async function findPendingInvitationByEmail(email: string) {
  return db.invitation.findFirst({
    where: {
      email: normalizeEmail(email),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function findUsableInvitationByToken(token: string) {
  const invite = await findInvitationByToken(token);

  if (getInvitationStatus(invite) !== "pending") {
    return null;
  }

  return invite;
}
