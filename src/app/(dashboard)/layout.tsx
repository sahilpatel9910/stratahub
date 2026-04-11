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

  let buildings: { id: string; name: string; suburb: string }[] = [];
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
      buildings = await db.building.findMany({
        select: { id: true, name: true, suburb: true },
        orderBy: { name: "asc" },
      });
    } else if (dbUser) {
      const assignments = await db.buildingAssignment.findMany({
        where: { userId: dbUser.id, isActive: true },
        include: {
          building: { select: { id: true, name: true, suburb: true } },
        },
        orderBy: { building: { name: "asc" } },
      });
      buildings = assignments.map((a) => a.building);
    }
  }

  return (
    <TRPCProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar isSuperAdmin={isSuperAdmin} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar buildings={buildings} />
            <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </TRPCProvider>
  );
}
