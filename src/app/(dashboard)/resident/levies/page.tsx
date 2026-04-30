import { createServerTRPC } from "@/lib/trpc/server";
import ResidentLeviesClient from "./_client";

export default async function ResidentLeviesPage() {
  const { trpc, HydrateClient } = await createServerTRPC();

  await Promise.all([
    trpc.resident.getMyLevies.prefetch({}),
    trpc.customBills.getMyBills.prefetch({}),
    trpc.owner.getFinancialSummary.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ResidentLeviesClient />
    </HydrateClient>
  );
}
