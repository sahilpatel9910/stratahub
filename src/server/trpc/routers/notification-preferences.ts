import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { NotificationType } from "@/generated/prisma/client";

const ALL_TYPES = Object.values(NotificationType);

export const notificationPreferencesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    const existing = await ctx.db.notificationPreference.findMany({
      where: { userId },
    });

    const existingMap = new Map(existing.map((p) => [p.type, p.enabled]));

    return ALL_TYPES.map((type) => ({
      type,
      enabled: existingMap.has(type) ? existingMap.get(type)! : true,
    }));
  }),

  update: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(NotificationType),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;
      return ctx.db.notificationPreference.upsert({
        where: { userId_type: { userId, type: input.type } },
        create: { userId, type: input.type, enabled: input.enabled },
        update: { enabled: input.enabled },
      });
    }),
});
