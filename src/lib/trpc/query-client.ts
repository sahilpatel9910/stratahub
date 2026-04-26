import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Shared QueryClient factory used by both the server (prefetch) and the client
 * (TRPCProvider). Must include superjson serializers so that dehydrated state
 * produced on the server is correctly deserialized on the client.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: superjson.serialize,
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
