import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { ROLE_RANK } from "@/lib/auth/roles";

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

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been accepted." }, { status: 409 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  // Ensure the logged-in user is the one the invite was sent to
  if (authUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite is for ${invite.email}. Please sign out and sign in with that account.` },
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
        email: authUser.email!,
        firstName: meta?.first_name ?? authUser.email!.split("@")[0],
        lastName: meta?.last_name ?? "",
      },
    });
  }

  // Upsert org membership — never downgrade a higher existing role
  const existingMembership = await db.organisationMembership.findUnique({
    where: { userId_organisationId: { userId: dbUser.id, organisationId: invite.organisationId } },
  });

  if (!existingMembership) {
    await db.organisationMembership.create({
      data: { userId: dbUser.id, organisationId: invite.organisationId, role: invite.role },
    });
  } else {
    const newRank = ROLE_RANK[invite.role];
    const existingRank = ROLE_RANK[existingMembership.role];
    await db.organisationMembership.update({
      where: { userId_organisationId: { userId: dbUser.id, organisationId: invite.organisationId } },
      // Only update role if the invite grants higher privilege; always reactivate
      data: {
        isActive: true,
        ...(newRank > existingRank ? { role: invite.role } : {}),
      },
    });
  }

  // Upsert building assignment if a building was specified — never downgrade a higher existing role
  if (invite.buildingId) {
    const existingAssignment = await db.buildingAssignment.findFirst({
      where: { userId: dbUser.id, buildingId: invite.buildingId },
    });

    if (!existingAssignment) {
      await db.buildingAssignment.create({
        data: { userId: dbUser.id, buildingId: invite.buildingId, role: invite.role },
      });
    } else {
      const newRank = ROLE_RANK[invite.role];
      const existingRank = ROLE_RANK[existingAssignment.role];
      await db.buildingAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          isActive: true,
          ...(newRank > existingRank ? { role: invite.role } : {}),
        },
      });
    }
  }

  // Mark invite as accepted
  await db.invitation.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
