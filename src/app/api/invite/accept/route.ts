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

  // Find or create the Prisma user record
  let dbUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (!dbUser) {
    // Create the Prisma record from Supabase metadata
    const meta = authUser.user_metadata as Record<string, string> | undefined;
    dbUser = await db.user.create({
      data: {
        supabaseAuthId: authUser.id,
        email: normalizeEmail(authUser.email!),
        firstName: meta?.first_name ?? authUser.email!.split("@")[0],
        lastName: meta?.last_name ?? "",
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

  const ownerUnitId = activeInvite.unitId;

  if (ownerUnitId && activeInvite.role === "OWNER") {
    await db.$transaction(async (tx) => {
      await tx.ownership.updateMany({
        where: { unitId: ownerUnitId, isActive: true },
        data: { isActive: false },
      });

      await tx.tenancy.updateMany({
        where: { unitId: ownerUnitId, isActive: true },
        data: {
          isActive: false,
          moveOutDate: new Date(),
        },
      });

      await tx.ownership.upsert({
        where: {
          userId_unitId: {
            userId: dbUser.id,
            unitId: ownerUnitId,
          },
        },
        create: {
          userId: dbUser.id,
          unitId: ownerUnitId,
          isPrimary: true,
          ownershipPct: 100,
          purchaseDate: new Date(),
        },
        update: {
          isActive: true,
          isPrimary: true,
          ownershipPct: 100,
          purchaseDate: new Date(),
        },
      });

      await tx.unit.update({
        where: { id: ownerUnitId },
        data: { isOccupied: true },
      });
    });
  }

  // Mark invite as accepted
  await db.invitation.update({
    where: { id: activeInvite.id },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
