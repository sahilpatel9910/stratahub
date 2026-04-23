import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
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

  create: buildingManagerProcedure
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

      const announcement = await ctx.db.announcement.create({
        data: {
          ...input,
          authorId: ctx.user!.id,
          publishedAt: new Date(),
        },
      });

      // Notify all active building residents (owners + tenants)
      try {
        const [ownerships, tenancies] = await Promise.all([
          ctx.db.ownership.findMany({
            where: { unit: { buildingId: input.buildingId }, isActive: true },
            select: { userId: true },
          }),
          ctx.db.tenancy.findMany({
            where: { unit: { buildingId: input.buildingId }, isActive: true },
            select: { userId: true },
          }),
        ]);
        const seen = new Set<string>();
        const residents = [...ownerships, ...tenancies].filter(({ userId }) => {
          if (seen.has(userId)) return false;
          seen.add(userId);
          return true;
        });
        if (residents.length > 0) {
          await ctx.db.notification.createMany({
            data: residents.map(({ userId }) => ({
              userId,
              type: "ANNOUNCEMENT_PUBLISHED" as const,
              title: `New announcement: ${input.title}`,
              body: input.content.length > 120 ? `${input.content.slice(0, 117)}...` : input.content,
              linkUrl: "/resident/announcements",
              isRead: false,
            })),
          });
        }
      } catch (err) {
        console.error("[notification] ANNOUNCEMENT_PUBLISHED failed:", err);
      }

      return announcement;
    }),

  delete: buildingManagerProcedure
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
