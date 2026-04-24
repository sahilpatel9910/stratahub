import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

export const avatarRouter = createTRPCRouter({
  setUrl: protectedProcedure
    .input(z.object({ url: z.string().url().nullable() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user!.id },
        data: { avatarUrl: input.url },
        select: { id: true, avatarUrl: true },
      });
    }),
});
