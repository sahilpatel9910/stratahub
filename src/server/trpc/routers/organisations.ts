import { z } from "zod";
import {
  createTRPCRouter,
  superAdminProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

export const organisationsRouter = createTRPCRouter({
  list: superAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.organisation.findMany({
      include: {
        _count: { select: { buildings: true, members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.organisation.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          buildings: true,
          members: { include: { user: true } },
        },
      });
    }),

  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        abn: z.string().optional(),
        state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.organisation.create({ data: input });
    }),

  update: superAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        abn: z.string().optional(),
        state: z
          .enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"])
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.organisation.update({ where: { id }, data });
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.organisation.delete({ where: { id: input.id } });
    }),
});
