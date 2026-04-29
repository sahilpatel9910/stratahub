import { createServerTRPC } from "@/lib/trpc/server";
import TenancyDetailClient from "./_client";

export default async function TenancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trpc, HydrateClient } = await createServerTRPC();
  await trpc.tenancy.getById.prefetch({ id });

  return (
    <HydrateClient>
      <TenancyDetailClient id={id} />
    </HydrateClient>
  );
}
