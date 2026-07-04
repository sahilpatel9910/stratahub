import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { hasBuildingOperationsAccess } from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "inspections";
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/storage/inspection-upload-url
 * Body: { filename: string, contentType: string, inspectionId: string }
 *
 * Returns a signed upload URL so the client can PUT the image directly to
 * Supabase Storage. Inspections are staff-run, so the caller must have
 * operations access (manager/reception) to the inspection's building.
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
  const inspectionId = (body.inspectionId as string)?.trim();

  if (!filename || !contentType || !inspectionId) {
    return NextResponse.json(
      { error: "filename, contentType, and inspectionId are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase())) {
    return NextResponse.json(
      { error: "Only image uploads are allowed for inspections." },
      { status: 400 }
    );
  }

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    select: { unit: { select: { buildingId: true } } },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  if (!hasBuildingOperationsAccess(dbUser, inspection.unit.buildingId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${inspectionId}/${Date.now()}-${safeName}`;

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("Inspection storage signed URL error:", error);
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
