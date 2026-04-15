import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasBuildingManagementAccess, isSuperAdmin } from "@/server/auth/building-access";

const BUCKET = "documents";

/**
 * DELETE /api/storage/delete
 * Body: { documentId: string }
 *
 * Removes a file from Supabase Storage using the service role key.
 * Only callable by staff who can manage the building that owns the document.
 */
export async function DELETE(req: NextRequest) {
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
  const documentId = (body.documentId as string)?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  const document = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      storagePath: true,
      buildingId: true,
      tenancyId: true,
    },
  });

  if (!document?.storagePath) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let allowed = false;

  if (document.buildingId) {
    allowed = hasBuildingManagementAccess(dbUser, document.buildingId);
  } else if (document.tenancyId) {
    const tenancy = await db.tenancy.findUnique({
      where: { id: document.tenancyId },
      select: { unit: { select: { buildingId: true } } },
    });
    allowed = tenancy ? hasBuildingManagementAccess(dbUser, tenancy.unit.buildingId) : false;
  } else {
    allowed = isSuperAdmin(dbUser);
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have permission to delete this document." },
      { status: 403 }
    );
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.storage.from(BUCKET).remove([document.storagePath]);

  if (error) {
    console.error("Storage delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
