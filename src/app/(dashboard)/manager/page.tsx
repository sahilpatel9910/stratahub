import { createServerTRPC } from "@/lib/trpc/server";
import ManagerDashboardClient from "./_client";

export default async function ManagerDashboardPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  // Only prefetch when the user has exactly one building assignment.
  // Multi-building managers have a Zustand-persisted selectedBuildingId (localStorage)
  // that may differ from buildingAssignments[0], causing a cache miss and wasted prefetch.
  // Super-admins have no buildingAssignments — they use the building switcher.
  const assignments = ctx.user?.buildingAssignments ?? [];
  const buildingId = assignments.length === 1 ? assignments[0].buildingId : undefined;

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
