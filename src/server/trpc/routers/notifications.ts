import { z } from "zod";
import { NotificationType } from "@/generated/prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

export const notificationsRouter = createTRPCRouter({
  listRecent: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.notification.findMany({
        where: { userId: ctx.user!.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({
      where: { userId: ctx.user!.id, isRead: false },
    });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.updateMany({
        where: { id: input.id, userId: ctx.user!.id },
        data: { isRead: true },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.notification.updateMany({
      where: { userId: ctx.user!.id, isRead: false },
      data: { isRead: true },
    });
  }),

  listPaginated: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(NotificationType).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, cursor, limit } = input;
      const results = await ctx.db.notification.findMany({
        where: { userId: ctx.user!.id, ...(type && { type }) },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (results.length > limit) {
        const poppedItem = results.pop()!;
        return { items: results, nextCursor: poppedItem.id };
      }
      return { items: results, nextCursor: undefined };
    }),
});
