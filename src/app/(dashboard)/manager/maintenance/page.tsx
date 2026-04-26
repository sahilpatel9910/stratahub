import { createServerTRPC } from "@/lib/trpc/server";
import MaintenanceClient from "./_client";

export default async function MaintenancePage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const buildingId = ctx.user?.buildingAssignments[0]?.buildingId;

  if (buildingId) {
    await trpc.maintenance.listByBuilding.prefetch({ buildingId });
  }

  return (
    <HydrateClient>
      <MaintenanceClient />
    </HydrateClient>
  );
}
