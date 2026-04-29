import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "inspections";

/**
 * POST /api/storage/inspection-upload-url
 * Body: { filename: string, contentType: string, inspectionId: string }
 *
 * Returns a signed upload URL so the client can PUT the image directly to
 * Supabase Storage. Caller must be an authenticated user with access to the inspection.
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
