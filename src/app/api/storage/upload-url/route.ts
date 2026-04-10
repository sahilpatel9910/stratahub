import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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

  // Use service role client to bypass Storage RLS
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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

  // Public URL for reading after upload
  const { data: { publicUrl } } = adminClient.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: storagePath,
    publicUrl,
  });
}
