import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await db.invitation.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  // Fetch org and building names separately
  const [org, building] = await Promise.all([
    db.organisation.findUnique({
      where: { id: invite.organisationId },
      select: { name: true },
    }),
    invite.buildingId
      ? db.building.findUnique({
          where: { id: invite.buildingId },
          select: { name: true, suburb: true },
        })
      : null,
  ]);

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    organisation: org,
    building: building,
    expired: invite.expiresAt < new Date(),
    accepted: !!invite.acceptedAt,
  });
}
