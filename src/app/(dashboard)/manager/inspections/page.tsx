import { createServerTRPC } from "@/lib/trpc/server";
import InspectionsClient from "./_client";

export default async function InspectionsPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const assignments = ctx.user?.buildingAssignments ?? [];
  const buildingId = assignments.length === 1 ? assignments[0].buildingId : undefined;

  if (buildingId) {
    await trpc.inspection.listByBuilding.prefetch({ buildingId });
  }

  return (
    <HydrateClient>
      <InspectionsClient />
    </HydrateClient>
  );
}
