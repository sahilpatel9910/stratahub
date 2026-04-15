import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { searchParams } = new URL(req.url);
  const redirectParam = searchParams.get("redirect") ?? "/login";

  // Only allow relative paths — reject anything that could redirect off-site
  const safeRedirect =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/login";

  return NextResponse.redirect(new URL(safeRedirect, req.url));
}
