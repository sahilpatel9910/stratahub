import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingAccess, assertBuildingManagementAccess } from "@/server/auth/building-access";

export const announcementsRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.announcement.findMany({
        where: {
          buildingId: input.buildingId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        title: z.string().min(1),
        content: z.string().min(1),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
        scope: z.enum(["BUILDING", "FLOOR", "ALL_BUILDINGS"]).default("BUILDING"),
        targetFloors: z.array(z.number()).default([]),
        expiresAt: z.string().transform((s) => new Date(s)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.announcement.create({
        data: {
          ...input,
          authorId: ctx.user!.id,
          publishedAt: new Date(),
        },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.db.announcement.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, announcement.buildingId);

      return ctx.db.announcement.delete({ where: { id: input.id } });
    }),
});
