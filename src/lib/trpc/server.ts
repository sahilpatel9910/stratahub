import "server-only";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { createCallerFactory, createTRPCContext } from "@/server/trpc/trpc";
import { appRouter } from "@/server/trpc/router";
import { makeQueryClient } from "./query-client";
import type { QueryClient } from "@tanstack/react-query";

const callerFactory = createCallerFactory(appRouter);

/**
 * Creates a tRPC caller + HydrateClient wrapper for use in server components.
 *
 * Usage:
 * ```tsx
 * const { trpc, HydrateClient } = await createServerTRPC();
 * await trpc.buildings.getStats.prefetch({ buildingId });
 * return <HydrateClient><PageClient /></HydrateClient>;
 * ```
 */
export async function createServerTRPC() {
  const ctx = await createTRPCContext();
  const queryClient: QueryClient = makeQueryClient();
  const caller = callerFactory(ctx);

  const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
    caller,
    () => queryClient
  );

  return { trpc, HydrateClient, ctx, queryClient };
}
