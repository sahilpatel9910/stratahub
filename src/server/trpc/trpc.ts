import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db/client";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/generated/prisma/client";

export async function createTRPCContext() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  let user = null;
  if (supabaseUser) {
    user = await db.user.findUnique({
      where: { supabaseAuthId: supabaseUser.id },
      include: {
        orgMemberships: { where: { isActive: true } },
        buildingAssignments: { where: { isActive: true } },
      },
    });
  }

  return {
    db,
    supabase,
    supabaseUser,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Middleware: requires authentication
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// Middleware: requires specific role — checks both org memberships and building assignments
function enforceRole(...allowedRoles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const userRoles = [
      ...ctx.user.orgMemberships.map((m) => m.role),
      ...ctx.user.buildingAssignments.map((a) => a.role),
    ];
    const hasRole = userRoles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    return next({ ctx: { user: ctx.user } });
  });
}

export const superAdminProcedure = t.procedure.use(enforceRole("SUPER_ADMIN"));
export const managerProcedure = t.procedure.use(
  enforceRole("SUPER_ADMIN", "BUILDING_MANAGER", "RECEPTION")
);
export const buildingManagerProcedure = t.procedure.use(
  enforceRole("SUPER_ADMIN", "BUILDING_MANAGER")
);
export const ownerProcedure = t.procedure.use(
  enforceRole("SUPER_ADMIN", "BUILDING_MANAGER", "OWNER")
);
export const tenantOrAboveProcedure = t.procedure.use(
  enforceRole("SUPER_ADMIN", "BUILDING_MANAGER", "RECEPTION", "OWNER", "TENANT")
);
