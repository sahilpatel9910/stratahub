import { createServerTRPC } from "@/lib/trpc/server";
import ResidentRentClient from "./_client";

export default async function ResidentRentPage() {
  const { trpc, HydrateClient, caller } = await createServerTRPC();

  // Call directly to get tenancyId, then prefetch both into the hydration cache
  const tenancy = await caller.resident.getMyTenancy();
  await Promise.all([
    trpc.resident.getMyTenancy.prefetch(),
    tenancy ? trpc.rent.listByTenancy.prefetch({ tenancyId: tenancy.id }) : Promise.resolve(),
  ]);

  return (
    <>
      <h1 className="sr-only">Rent</h1>
      <HydrateClient>
        <ResidentRentClient />
      </HydrateClient>
    </>
  );
}
