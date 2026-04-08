import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

export const rentRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
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
      return ctx.db.rentPayment.findMany({
        where: { tenancyId: input.tenancyId },
        orderBy: { dueDate: "desc" },
      });
    }),

  recordPayment: managerProcedure
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
      const payment = await ctx.db.rentPayment.findUniqueOrThrow({ where: { id } });
      const status = data.amountCents >= payment.amountCents ? "PAID" : "PARTIAL";
      return ctx.db.rentPayment.update({
        where: { id },
        data: { ...data, status },
      });
    }),

  generateSchedule: managerProcedure
    .input(
      z.object({
        tenancyId: z.string(),
        months: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
      });

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

  getRentRoll: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
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
