import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getAuthClaims } from "@/server/auth/request-auth";
import { db } from "@/server/db/client";
import { redirect } from "next/navigation";

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { claims } = await getAuthClaims();

  if (!claims) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { supabaseAuthId: claims.sub },
    include: {
      ownerships: {
        where: { isActive: true },
        include: {
          unit: {
            include: {
              building: {
                include: {
                  organisation: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      orgMemberships: {
        where: { isActive: true, role: "OWNER" },
        select: { role: true },
      },
    },
  });

  const ownedBuildings = Array.from(
    new Map(
      (dbUser?.ownerships ?? []).map((ownership) => [
        ownership.unit.building.id,
        {
          id: ownership.unit.building.id,
          name: ownership.unit.building.name,
          suburb: ownership.unit.building.suburb,
          organisationName: ownership.unit.building.organisation.name,
        },
      ])
    ).values()
  );

  const showBuildingSwitcher =
    (dbUser?.orgMemberships.some((membership) => membership.role === "OWNER") ?? false) &&
    ownedBuildings.length > 1;

  return (
    <div className="app-shell flex h-screen w-full">
      <ResidentSidebar />
      <div className="workspace-backdrop flex flex-1 flex-col overflow-hidden">
        <Topbar
          buildings={ownedBuildings}
          showBuildingSwitcher={showBuildingSwitcher}
          searchPlaceholder="Search announcements, documents, and updates..."
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
