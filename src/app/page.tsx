import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { findPendingInvitationByEmail } from "@/server/auth/invitations";
import { getRootRedirectPath } from "@/lib/auth/redirects";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect(
      getRootRedirectPath({
        hasAuthUser: false,
        hasAppUser: false,
        roles: [],
      })
    );
  }

  const dbUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    include: {
      orgMemberships: { where: { isActive: true }, select: { role: true } },
      buildingAssignments: { where: { isActive: true }, select: { role: true } },
    },
  });

  if (!dbUser) {
    const pendingInvite = authUser.email
      ? await findPendingInvitationByEmail(authUser.email)
      : null;

    redirect(
      getRootRedirectPath({
        hasAuthUser: true,
        hasAppUser: false,
        pendingInviteToken: pendingInvite?.token,
        roles: [],
      })
    );
  }

  if (dbUser.isSuperAdmin) {
    redirect("/super-admin/organisations");
  }

  const roles = [
    ...dbUser.orgMemberships.map((m) => m.role),
    ...dbUser.buildingAssignments.map((a) => a.role),
  ];

  const pendingInvite = roles.length === 0
    ? await findPendingInvitationByEmail(dbUser.email)
    : null;

  redirect(
    getRootRedirectPath({
      hasAuthUser: true,
      hasAppUser: true,
      pendingInviteToken: pendingInvite?.token,
      roles,
    })
  );
}
