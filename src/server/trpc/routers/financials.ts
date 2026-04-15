import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingManagementAccess } from "@/server/auth/building-access";

export const financialsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        type: z.enum(["INCOME", "EXPENSE"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.financialRecord.findMany({
        where: {
          buildingId: input.buildingId,
          ...(input.type ? { type: input.type } : {}),
          ...(input.from || input.to
            ? {
                date: {
                  ...(input.from ? { gte: new Date(input.from) } : {}),
                  ...(input.to ? { lte: new Date(input.to) } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: "desc" },
      });
    }),

  getSummary: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const [income, expense] = await Promise.all([
        ctx.db.financialRecord.aggregate({
          where: { buildingId: input.buildingId, type: "INCOME" },
          _sum: { amountCents: true },
        }),
        ctx.db.financialRecord.aggregate({
          where: { buildingId: input.buildingId, type: "EXPENSE" },
          _sum: { amountCents: true },
        }),
      ]);

      const totalIncome = income._sum.amountCents ?? 0;
      const totalExpense = expense._sum.amountCents ?? 0;

      return {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
      };
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        type: z.enum(["INCOME", "EXPENSE"]),
        category: z.string().min(1),
        description: z.string().min(1),
        amountCents: z.number().int().positive(),
        date: z.string(),
        receiptUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.financialRecord.create({
        data: {
          ...input,
          date: new Date(input.date),
        },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.financialRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, record.buildingId);

      return ctx.db.financialRecord.delete({ where: { id: input.id } });
    }),
});
