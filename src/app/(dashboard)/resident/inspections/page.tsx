import { createServerTRPC } from "@/lib/trpc/server";
import ResidentInspectionsClient from "./_client";

export default async function ResidentInspectionsPage() {
  const { HydrateClient } = await createServerTRPC();
  return (
    <HydrateClient>
      <ResidentInspectionsClient />
    </HydrateClient>
  );
}
