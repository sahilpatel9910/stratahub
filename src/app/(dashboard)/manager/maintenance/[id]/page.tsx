import { createServerTRPC } from "@/lib/trpc/server";
import ManagerMaintenanceDetailClient from "./_client";

export default async function ManagerMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trpc, HydrateClient } = await createServerTRPC();
  await trpc.maintenance.getById.prefetch({ id });
  return (
    <HydrateClient>
      <ManagerMaintenanceDetailClient id={id} />
    </HydrateClient>
  );
}
