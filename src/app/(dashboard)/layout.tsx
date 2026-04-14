import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TRPCProvider } from "@/lib/trpc/provider";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let buildings: { id: string; name: string; suburb: string; organisationName: string }[] = [];
  let isSuperAdmin = false;

  if (authUser) {
    let dbUser = await db.user.findUnique({
      where: { supabaseAuthId: authUser.id },
      include: {
        orgMemberships: {
          where: { isActive: true },
          select: { role: true },
        },
      },
    });

    // Auto-create Prisma user on first visit after email verification
    if (!dbUser && authUser.email) {
      const meta = authUser.user_metadata as Record<string, string> | undefined;
      dbUser = await db.user.create({
        data: {
          supabaseAuthId: authUser.id,
          email: authUser.email,
          firstName: meta?.first_name ?? meta?.firstName ?? "User",
          lastName: meta?.last_name ?? meta?.lastName ?? "",
        },
        include: {
          orgMemberships: { where: { isActive: true }, select: { role: true } },
        },
      });
    }

    isSuperAdmin = dbUser?.orgMemberships.some((m) => m.role === "SUPER_ADMIN") ?? false;

    if (isSuperAdmin) {
      const raw = await db.building.findMany({
        select: { id: true, name: true, suburb: true, organisation: { select: { name: true } } },
        orderBy: [{ organisation: { name: "asc" } }, { name: "asc" }],
      });
      buildings = raw.map((b) => ({ id: b.id, name: b.name, suburb: b.suburb, organisationName: b.organisation.name }));
    } else if (dbUser) {
      const assignments = await db.buildingAssignment.findMany({
        where: { userId: dbUser.id, isActive: true },
        include: {
          building: { select: { id: true, name: true, suburb: true, organisation: { select: { name: true } } } },
        },
        orderBy: [{ building: { organisation: { name: "asc" } } }, { building: { name: "asc" } }],
      });
      buildings = assignments.map((a) => ({ id: a.building.id, name: a.building.name, suburb: a.building.suburb, organisationName: a.building.organisation.name }));
    }
  }

  return (
    <TRPCProvider>
      <SidebarProvider>
        <div className="app-shell flex h-screen w-full">
          <AppSidebar isSuperAdmin={isSuperAdmin} />
          <div className="workspace-backdrop flex flex-1 flex-col overflow-hidden">
            <Topbar buildings={buildings} />
            <main className="app-main">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </TRPCProvider>
  );
}
