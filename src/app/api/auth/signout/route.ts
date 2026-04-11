import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { searchParams } = new URL(req.url);
  const redirect = searchParams.get("redirect") ?? "/login";

  return NextResponse.redirect(new URL(redirect, req.url));
}
