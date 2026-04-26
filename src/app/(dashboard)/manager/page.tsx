import { createServerTRPC } from "@/lib/trpc/server";
import ManagerDashboardClient from "./_client";

export default async function ManagerDashboardPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  // Resolve the user's first building assignment as the default for prefetch.
  // Super-admins have no buildingAssignments — they use the building switcher
  // and data loads client-side on first selection.
  const buildingId = ctx.user?.buildingAssignments[0]?.buildingId;

  if (buildingId) {
    await Promise.all([
      trpc.buildings.getStats.prefetch({ buildingId }),
      trpc.maintenance.listByBuilding.prefetch({ buildingId }),
      trpc.announcements.listByBuilding.prefetch({ buildingId }),
    ]);
  }

  return (
    <HydrateClient>
      <ManagerDashboardClient />
    </HydrateClient>
  );
}
