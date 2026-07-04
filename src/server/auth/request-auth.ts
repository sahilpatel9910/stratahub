import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db/client";

/**
 * Request-scoped auth helpers.
 *
 * getClaims() verifies the ES256 session JWT locally (WebCrypto + cached
 * JWKS) instead of getUser()'s ~50ms round trip to the Supabase Auth server,
 * and still refreshes the session when the token is about to expire.
 *
 * cache() dedupes the lookup across layout + page prefetch within a single
 * RSC render pass. In route handlers (the tRPC endpoint) there is no request
 * cache scope, so it degrades to a plain call — never shared across requests.
 */
export const getAuthClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, claims: error ? null : (data?.claims ?? null) };
});

/** Auth claims + the app user (with active role rows) in one deduped lookup. */
export const getRequestUser = cache(async () => {
  const { supabase, claims } = await getAuthClaims();
  if (!claims) return { supabase, claims: null, user: null };

  const user = await db.user.findUnique({
    where: { supabaseAuthId: claims.sub },
    include: {
      orgMemberships: { where: { isActive: true } },
      buildingAssignments: { where: { isActive: true } },
    },
  });

  return { supabase, claims, user };
});
