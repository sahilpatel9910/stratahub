import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { getDefaultDashboardPath } from "@/lib/auth/roles";
import { findPendingInvitationByEmail } from "@/server/auth/invitations";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
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

    if (pendingInvite) {
      redirect(`/invite/${pendingInvite.token}`);
    }

    redirect("/access-required");
  }

  const roles = [
    ...dbUser.orgMemberships.map((m) => m.role),
    ...dbUser.buildingAssignments.map((a) => a.role),
  ];

  if (roles.length === 0) {
    const pendingInvite = await findPendingInvitationByEmail(dbUser.email);

    if (pendingInvite) {
      redirect(`/invite/${pendingInvite.token}`);
    }
  }

  redirect(getDefaultDashboardPath(roles));
}
