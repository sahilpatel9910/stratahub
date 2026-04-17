import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { assertBuildingManagementAccess, hasBuildingManagementAccess } from "@/server/auth/building-access";

export const rentRouter = createTRPCRouter({
  listByBuilding: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.rentPayment.findMany({
        where: {
          tenancy: {
            unit: { buildingId: input.buildingId },
            isActive: true,
          },
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          tenancy: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              unit: { select: { unitNumber: true } },
            },
          },
        },
        orderBy: { dueDate: "desc" },
      });
    }),

  listByTenancy: protectedProcedure
    .input(z.object({ tenancyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
        select: {
          userId: true,
          unit: { select: { buildingId: true } },
        },
      });

      if (
        tenancy.userId !== ctx.user!.id &&
        !hasBuildingManagementAccess(ctx.user!, tenancy.unit.buildingId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this tenancy.",
        });
      }

      return ctx.db.rentPayment.findMany({
        where: { tenancyId: input.tenancyId },
        orderBy: { dueDate: "desc" },
      });
    }),

  recordPayment: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        amountCents: z.number().int().positive(),
        paidDate: z.string().transform((s) => new Date(s)),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const payment = await ctx.db.rentPayment.findUniqueOrThrow({
        where: { id },
        include: {
          tenancy: { select: { unit: { select: { buildingId: true } } } },
        },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, payment.tenancy.unit.buildingId);
      const status = data.amountCents >= payment.amountCents ? "PAID" : "PARTIAL";
      return ctx.db.rentPayment.update({
        where: { id },
        data: { ...data, status },
      });
    }),

  generateSchedule: buildingManagerProcedure
    .input(
      z.object({
        tenancyId: z.string(),
        months: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
        select: {
          leaseStartDate: true,
          rentFrequency: true,
          rentAmountCents: true,
          unit: { select: { buildingId: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      const payments = [];
      const startDate = new Date(tenancy.leaseStartDate);

      for (let i = 0; i < input.months; i++) {
        let dueDate: Date;
        if (tenancy.rentFrequency === "WEEKLY") {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + i * 7);
        } else if (tenancy.rentFrequency === "FORTNIGHTLY") {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + i * 14);
        } else {
          dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);
        }

        payments.push({
          tenancyId: input.tenancyId,
          amountCents: tenancy.rentAmountCents,
          dueDate,
          status: "PENDING" as const,
        });
      }

      return ctx.db.rentPayment.createMany({ data: payments });
    }),

  getRentRoll: buildingManagerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const tenancies = await ctx.db.tenancy.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          isActive: true,
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
          unit: { select: { unitNumber: true } },
          rentPayments: {
            where: { status: { in: ["PENDING", "OVERDUE"] } },
            orderBy: { dueDate: "asc" },
          },
        },
      });

      return tenancies.map((t) => ({
        unitNumber: t.unit.unitNumber,
        tenantName: `${t.user.firstName} ${t.user.lastName}`,
        rentAmountCents: t.rentAmountCents,
        rentFrequency: t.rentFrequency,
        leaseEnd: t.leaseEndDate,
        overduePayments: t.rentPayments.filter((p) => p.status === "OVERDUE").length,
        nextDue: t.rentPayments[0]?.dueDate ?? null,
      }));
    }),
});
