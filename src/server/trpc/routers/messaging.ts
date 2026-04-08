import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/trpc/trpc";

export const messagingRouter = createTRPCRouter({
  listThreads: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const messages = await ctx.db.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["threadId"],
    });

    return messages;
  }),

  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.message.findMany({
        where: { threadId: input.threadId },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        recipientId: z.string(),
        subject: z.string().optional(),
        content: z.string().min(1),
        threadId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const threadId = input.threadId ?? `thread_${Date.now()}_${ctx.user!.id}`;
      return ctx.db.message.create({
        data: {
          senderId: ctx.user!.id,
          recipientId: input.recipientId,
          subject: input.subject,
          content: input.content,
          threadId,
        },
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.message.updateMany({
        where: {
          threadId: input.threadId,
          recipientId: ctx.user!.id,
          isRead: false,
        },
        data: { isRead: true },
      });
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.message.count({
      where: { recipientId: ctx.user!.id, isRead: false },
    });
  }),
});
