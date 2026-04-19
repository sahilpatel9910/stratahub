import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      orgMemberships: {
        where: { isActive: true },
        select: { role: true },
      },
    },
  });

  const isSuperAdmin = dbUser?.orgMemberships.some((membership) => membership.role === "SUPER_ADMIN") ?? false;

  if (!isSuperAdmin) {
    redirect("/manager");
  }

  const rawBuildings = await db.building.findMany({
    select: {
      id: true,
      name: true,
      suburb: true,
      organisation: { select: { name: true } },
    },
    orderBy: [{ organisation: { name: "asc" } }, { name: "asc" }],
  });

  const buildings = rawBuildings.map((building) => ({
    id: building.id,
    name: building.name,
    suburb: building.suburb,
    organisationName: building.organisation.name,
  }));

  return (
    <div className="app-shell flex h-screen w-full">
      <AppSidebar isSuperAdmin />
      <div className="workspace-backdrop flex flex-1 flex-col overflow-hidden">
        <Topbar
          buildings={buildings}
          userInitials={
            dbUser
              ? `${dbUser.firstName[0]}${dbUser.lastName[0]}`.toUpperCase()
              : null
          }
        />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
