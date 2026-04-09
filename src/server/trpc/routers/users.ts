import { z } from "zod";
import {
  createTRPCRouter,
  superAdminProcedure,
} from "@/server/trpc/trpc";

export const usersRouter = createTRPCRouter({
  list: superAdminProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: input.search
          ? {
              OR: [
                { firstName: { contains: input.search, mode: "insensitive" } },
                { lastName: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          orgMemberships: {
            include: { organisation: { select: { name: true } } },
          },
          buildingAssignments: {
            where: { isActive: true },
            include: { building: { select: { name: true } } },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
    }),

  deactivateAssignments: superAdminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.buildingAssignment.updateMany({
        where: { userId: input.userId },
        data: { isActive: false },
      });
    }),
});
