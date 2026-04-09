import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const firstName = (body.firstName as string)?.trim();
  const lastName = (body.lastName as string)?.trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are required" },
      { status: 400 }
    );
  }

  // Idempotent — don't recreate if already exists
  const existing = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const user = await db.user.create({
    data: {
      supabaseAuthId: authUser.id,
      email: authUser.email!,
      firstName,
      lastName,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
