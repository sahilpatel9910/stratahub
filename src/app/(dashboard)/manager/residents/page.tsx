import { createServerTRPC } from "@/lib/trpc/server";
import ResidentsClient from "./_client";

export default async function ResidentsPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const assignments = ctx.user?.buildingAssignments ?? [];
  const buildingId = assignments.length === 1 ? assignments[0].buildingId : undefined;

  if (buildingId) {
    await Promise.all([
      trpc.residents.listByBuilding.prefetch({ buildingId }),
      trpc.units.listByBuilding.prefetch({ buildingId }),
    ]);
  }

  return (
    <>
      <h1 className="sr-only">Residents</h1>
      <HydrateClient>
        <ResidentsClient />
      </HydrateClient>
    </>
  );
}
