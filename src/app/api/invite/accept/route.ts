import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";

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

  // Upsert org membership
  await db.organisationMembership.upsert({
    where: {
      userId_organisationId: {
        userId: dbUser.id,
        organisationId: invite.organisationId,
      },
    },
    create: {
      userId: dbUser.id,
      organisationId: invite.organisationId,
      role: invite.role,
    },
    update: { role: invite.role, isActive: true },
  });

  // Upsert building assignment if a building was specified
  if (invite.buildingId) {
    const existing = await db.buildingAssignment.findFirst({
      where: { userId: dbUser.id, buildingId: invite.buildingId },
    });

    if (existing) {
      await db.buildingAssignment.update({
        where: { id: existing.id },
        data: { role: invite.role, isActive: true },
      });
    } else {
      await db.buildingAssignment.create({
        data: {
          userId: dbUser.id,
          buildingId: invite.buildingId,
          role: invite.role,
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
