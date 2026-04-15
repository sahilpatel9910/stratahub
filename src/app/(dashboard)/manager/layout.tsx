import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { hasManagerPortalAccess } from "@/lib/auth/roles";

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

  const hasManagerAccess = hasManagerPortalAccess(roles);

  if (!hasManagerAccess) {
    redirect("/resident");
  }

  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  let buildings: { id: string; name: string; suburb: string; organisationName: string }[] = [];

  if (isSuperAdmin) {
    const rawBuildings = await db.building.findMany({
      select: {
        id: true,
        name: true,
        suburb: true,
        organisation: { select: { name: true } },
      },
      orderBy: [{ organisation: { name: "asc" } }, { name: "asc" }],
    });

    buildings = rawBuildings.map((building) => ({
      id: building.id,
      name: building.name,
      suburb: building.suburb,
      organisationName: building.organisation.name,
    }));
  } else if (dbUser) {
    const assignments = await db.buildingAssignment.findMany({
      where: { userId: dbUser.id, isActive: true },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            suburb: true,
            organisation: { select: { name: true } },
          },
        },
      },
      orderBy: [{ building: { organisation: { name: "asc" } } }, { building: { name: "asc" } }],
    });

    buildings = assignments.map((assignment) => ({
      id: assignment.building.id,
      name: assignment.building.name,
      suburb: assignment.building.suburb,
      organisationName: assignment.building.organisation.name,
    }));
  }

  return (
    <div className="app-shell flex h-screen w-full">
      <AppSidebar isSuperAdmin={isSuperAdmin} />
      <div className="workspace-backdrop flex flex-1 flex-col overflow-hidden">
        <Topbar buildings={buildings} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
