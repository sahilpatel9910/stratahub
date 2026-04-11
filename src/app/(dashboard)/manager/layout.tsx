import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";

/**
 * Guards all /manager/** routes.
 * OWNER and TENANT roles are redirected to /resident — they have no business
 * in the manager portal. SUPER_ADMIN, BUILDING_MANAGER, RECEPTION are allowed.
 */
export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const dbUser = await db.user.findUnique({
    where: { supabaseAuthId: authUser.id },
    include: {
      orgMemberships: { where: { isActive: true }, select: { role: true } },
      buildingAssignments: { where: { isActive: true }, select: { role: true } },
    },
  });

  const roles = [
    ...(dbUser?.orgMemberships.map((m) => m.role) ?? []),
    ...(dbUser?.buildingAssignments.map((a) => a.role) ?? []),
  ];

  const hasManagerAccess = roles.some((r) =>
    ["SUPER_ADMIN", "BUILDING_MANAGER", "RECEPTION"].includes(r)
  );

  if (!hasManagerAccess) {
    redirect("/resident");
  }

  return <>{children}</>;
}
