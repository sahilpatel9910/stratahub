import { createServerTRPC } from "@/lib/trpc/server";
import MaintenanceClient from "./_client";

export default async function MaintenancePage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const assignments = ctx.user?.buildingAssignments ?? [];
  const buildingId = assignments.length === 1 ? assignments[0].buildingId : undefined;

  if (buildingId) {
    await trpc.maintenance.listByBuilding.prefetch({ buildingId });
  }

  return (
    <HydrateClient>
      <MaintenanceClient />
    </HydrateClient>
  );
}
