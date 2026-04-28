import { createServerTRPC } from "@/lib/trpc/server";
import ResidentDashboardClient from "./_client";

export default async function ResidentDashboardPage() {
  const { trpc, HydrateClient } = await createServerTRPC();

  // Prefetch all data the resident dashboard needs — no buildingId required,
  // resident procedures resolve the building from the session user's ownerships/tenancies.
  await Promise.all([
    trpc.resident.getMyProfile.prefetch(),
    trpc.resident.getMyLevies.prefetch({}),
    trpc.customBills.getMyBills.prefetch({}),
    trpc.resident.getMyMaintenanceRequests.prefetch({}),
    trpc.resident.getMyAnnouncements.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ResidentDashboardClient />
    </HydrateClient>
  );
}
