import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { ROLE_RANK } from "@/lib/auth/roles";
import { emailsMatch, getInvitationStatus, normalizeEmail } from "@/lib/auth/invitations";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "You must be signed in to accept an invite." }, { status: 401 });
  }

  const { token } = await req.json().catch(() => ({}));
  if (!token) {
    return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  }

  // Look up the invitation
  const invite = await db.invitation.findUnique({ where: { token } });
  const inviteStatus = getInvitationStatus(invite);

  if (inviteStatus === "missing") {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (inviteStatus === "accepted") {
    return NextResponse.json({ error: "This invite has already been accepted." }, { status: 409 });
  }
  if (inviteStatus === "revoked") {
    return NextResponse.json({ error: "This invite has been revoked." }, { status: 410 });
  }
  if (inviteStatus === "expired") {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  const activeInvite = invite!;

  // Ensure the logged-in user is the one the invite was sent to
  if (!emailsMatch(authUser.email, activeInvite.email)) {
    return NextResponse.json(
      { error: `This invite is for ${activeInvite.email}. Please sign out and sign in with that account.` },
      { status: 403 }
    );
  }

  const meta = authUser.user_metadata as Record<string, string> | undefined;
  const normalizedEmail = normalizeEmail(authUser.email!);

  // Find pre-created user by email (created at invite time), or find by supabaseAuthId,
  // or create fresh if neither exists.
  let dbUser = await db.user.findFirst({
    where: { email: normalizedEmail },
  });

  if (!dbUser) {
    dbUser = await db.user.create({
      data: {
        supabaseAuthId: authUser.id,
        email: normalizedEmail,
        firstName: meta?.first_name ?? meta?.firstName ?? normalizedEmail.split("@")[0],
        lastName: meta?.last_name ?? meta?.lastName ?? "",
      },
    });
  } else if (!dbUser.supabaseAuthId) {
    // Pre-created user activating their account for the first time — link auth ID and fill name.
    dbUser = await db.user.update({
      where: { id: dbUser.id },
      data: {
        supabaseAuthId: authUser.id,
        firstName: (meta?.first_name ?? meta?.firstName ?? "").trim() || dbUser.firstName,
        lastName: (meta?.last_name ?? meta?.lastName ?? "").trim() || dbUser.lastName,
      },
    });
  }

  // Upsert org membership — never downgrade a higher existing role
  const existingMembership = await db.organisationMembership.findUnique({
    where: {
      userId_organisationId: {
        userId: dbUser.id,
        organisationId: activeInvite.organisationId,
      },
    },
  });

  if (!existingMembership) {
    await db.organisationMembership.create({
      data: {
        userId: dbUser.id,
        organisationId: activeInvite.organisationId,
        role: activeInvite.role,
      },
    });
  } else {
    const newRank = ROLE_RANK[activeInvite.role];
    const existingRank = ROLE_RANK[existingMembership.role];
    await db.organisationMembership.update({
      where: {
        userId_organisationId: {
          userId: dbUser.id,
          organisationId: activeInvite.organisationId,
        },
      },
      // Only update role if the invite grants higher privilege; always reactivate
      data: {
        isActive: true,
        ...(newRank > existingRank ? { role: activeInvite.role } : {}),
      },
    });
  }

  // Upsert building assignment if a building was specified — never downgrade a higher existing role
  if (activeInvite.buildingId) {
    const existingAssignment = await db.buildingAssignment.findFirst({
      where: { userId: dbUser.id, buildingId: activeInvite.buildingId },
    });

    if (!existingAssignment) {
      await db.buildingAssignment.create({
        data: {
          userId: dbUser.id,
          buildingId: activeInvite.buildingId,
          role: activeInvite.role,
        },
      });
    } else {
      const newRank = ROLE_RANK[activeInvite.role];
      const existingRank = ROLE_RANK[existingAssignment.role];
      await db.buildingAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          isActive: true,
          ...(newRank > existingRank ? { role: activeInvite.role } : {}),
        },
      });
    }
  }

  // Tenancy and ownership are NOT created here.
  // Unit assignment (and tenancy/ownership creation) is done by the manager
  // via the Units page after the resident is in the building roster.

  // Mark invite as accepted
  await db.invitation.update({
    where: { id: activeInvite.id },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
