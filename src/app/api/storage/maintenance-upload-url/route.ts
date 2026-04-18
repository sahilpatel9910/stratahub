import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { hasBuildingManagementAccess } from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "maintenance";

/**
 * POST /api/storage/maintenance-upload-url
 * Body: { filename: string, contentType: string, maintenanceRequestId: string }
 *
 * Returns a signed upload URL so the client can PUT the image directly to
 * Supabase Storage. Caller must be the request owner or a building manager.
 */
export async function POST(req: NextRequest) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await db.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: {
      orgMemberships: { where: { isActive: true } },
      buildingAssignments: { where: { isActive: true } },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const filename = (body.filename as string)?.trim();
  const contentType = (body.contentType as string)?.trim();
  const maintenanceRequestId = (body.maintenanceRequestId as string)?.trim();

  if (!filename || !contentType || !maintenanceRequestId) {
    return NextResponse.json(
      { error: "filename, contentType, and maintenanceRequestId are required" },
      { status: 400 }
    );
  }

  // Resolve the maintenance request to get buildingId + check ownership
  const request = await db.maintenanceRequest.findUnique({
    where: { id: maintenanceRequestId },
    select: {
      requestedById: true,
      unit: { select: { buildingId: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });
  }

  const isOwner = request.requestedById === dbUser.id;
  const hasManagementAccess = hasBuildingManagementAccess(dbUser, request.unit.buildingId);

  if (!isOwner && !hasManagementAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${request.unit.buildingId}/${maintenanceRequestId}/${Date.now()}-${safeName}`;

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("Maintenance storage signed URL error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: storagePath,
  });
}
