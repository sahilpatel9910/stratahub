import { createServerTRPC } from "@/lib/trpc/server";
import InspectionDetailClient from "./_client";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trpc, HydrateClient } = await createServerTRPC();
  await trpc.inspection.getById.prefetch({ id });

  return (
    <>
      <h1 className="sr-only" aria-hidden="true">Inspection Detail</h1>
      <HydrateClient>
        <InspectionDetailClient id={id} />
      </HydrateClient>
    </>
  );
}
