import { z } from "zod";
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
});
