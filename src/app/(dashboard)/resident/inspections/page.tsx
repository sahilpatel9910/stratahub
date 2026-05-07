import { createServerTRPC } from "@/lib/trpc/server";
import ResidentInspectionsClient from "./_client";

export default async function ResidentInspectionsPage() {
  const { HydrateClient } = await createServerTRPC();
  return (
    <>
      <h1 className="sr-only" aria-hidden="true">Inspections</h1>
      <HydrateClient>
        <ResidentInspectionsClient />
      </HydrateClient>
    </>
  );
}
