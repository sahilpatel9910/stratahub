import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "documents";

/**
 * DELETE /api/storage/delete
 * Body: { path: string }
 *
 * Removes a file from Supabase Storage using the service role key.
 * Only callable by authenticated users.
 */
export async function DELETE(req: NextRequest) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const path = (body.path as string)?.trim();

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await adminClient.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error("Storage delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
