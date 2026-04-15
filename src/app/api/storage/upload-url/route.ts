import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { hasBuildingManagementAccess } from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "documents";

/**
 * POST /api/storage/upload-url
 * Body: { filename: string, contentType: string, buildingId: string }
 *
 * Returns a signed upload URL so the client can PUT the file directly to
 * Supabase Storage without routing the bytes through Next.js.
 * Uses the service role key so no storage RLS policies are needed.
 */
export async function POST(req: NextRequest) {
  // Verify the caller is authenticated
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
  const buildingId = (body.buildingId as string)?.trim();

  if (!filename || !contentType || !buildingId) {
    return NextResponse.json(
      { error: "filename, contentType, and buildingId are required" },
      { status: 400 }
    );
  }

  if (!hasBuildingManagementAccess(dbUser, buildingId)) {
    return NextResponse.json(
      { error: "You do not have permission to upload documents for this building." },
      { status: 403 }
    );
  }

  // Use service role client to bypass Storage RLS
  const adminClient = createAdminClient();

  // Store files under buildingId/userId/timestamp-filename
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${buildingId}/${user.id}/${Date.now()}-${safeName}`;

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("Storage signed URL error:", error);
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
