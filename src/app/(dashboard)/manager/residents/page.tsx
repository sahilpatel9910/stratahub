import { createServerTRPC } from "@/lib/trpc/server";
import ResidentsClient from "./_client";

export default async function ResidentsPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const buildingId = ctx.user?.buildingAssignments[0]?.buildingId;

  if (buildingId) {
    await Promise.all([
      trpc.residents.listByBuilding.prefetch({ buildingId }),
      trpc.units.listByBuilding.prefetch({ buildingId }),
    ]);
  }

  return (
    <HydrateClient>
      <ResidentsClient />
    </HydrateClient>
  );
}
