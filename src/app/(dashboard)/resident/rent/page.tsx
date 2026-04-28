import { createServerTRPC } from "@/lib/trpc/server";
import ResidentRentClient from "./_client";

export default async function ResidentRentPage() {
  const { trpc, HydrateClient } = await createServerTRPC();

  await trpc.resident.getMyTenancy.prefetch();

  return (
    <HydrateClient>
      <ResidentRentClient />
    </HydrateClient>
  );
}
