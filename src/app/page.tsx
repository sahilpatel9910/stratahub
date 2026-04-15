import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { getDefaultDashboardPath } from "@/lib/auth/roles";

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
    redirect("/login");
  }

  const roles = [
    ...dbUser.orgMemberships.map((m) => m.role),
    ...dbUser.buildingAssignments.map((a) => a.role),
  ];

  redirect(getDefaultDashboardPath(roles));
}
