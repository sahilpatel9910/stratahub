import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { assertBuildingManagementAccess, hasBuildingManagementAccess } from "@/server/auth/building-access";
import { isTenancySetupPending } from "@/lib/tenancies";

const rentFrequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]);

function buildRentScheduleEntries({
  tenancyId,
  leaseStartDate,
  rentFrequency,
  rentAmountCents,
  months,
}: {
  tenancyId: string;
  leaseStartDate: Date;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  rentAmountCents: number;
  months: number;
}) {
  const payments = [];
  const startDate = new Date(leaseStartDate);

  for (let i = 0; i < months; i++) {
    let dueDate: Date;
    if (rentFrequency === "WEEKLY") {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + i * 7);
    } else if (rentFrequency === "FORTNIGHTLY") {
      dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + i * 14);
    } else {
      dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
    }

    payments.push({
      tenancyId,
      amountCents: rentAmountCents,
      dueDate,
      status: "PENDING" as const,
    });
  }

  return payments;
}

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

  listPendingSetupByBuilding: buildingManagerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const tenancies = await ctx.db.tenancy.findMany({
        where: {
          isActive: true,
          unit: { buildingId: input.buildingId },
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          unit: { select: { unitNumber: true } },
          rentPayments: {
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return tenancies.filter(
        (tenancy) =>
          isTenancySetupPending(tenancy) && tenancy.rentPayments.length === 0
      );
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
          _count: { select: { rentPayments: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      if (tenancy._count.rentPayments > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A payment schedule already exists for this tenancy. Delete existing payments before regenerating.",
        });
      }

      const payments = buildRentScheduleEntries({
        tenancyId: input.tenancyId,
        leaseStartDate: tenancy.leaseStartDate,
        rentFrequency: tenancy.rentFrequency,
        rentAmountCents: tenancy.rentAmountCents,
        months: input.months,
      });

      return ctx.db.rentPayment.createMany({ data: payments });
    }),

  completeTenancySetup: buildingManagerProcedure
    .input(
      z.object({
        tenancyId: z.string(),
        leaseStartDate: z.date(),
        leaseEndDate: z.date().nullable().optional(),
        rentAmountCents: z.number().int().positive(),
        rentFrequency: rentFrequencyEnum,
        bondAmountCents: z.number().int().min(0),
        moveInDate: z.date().nullable().optional(),
        createSchedule: z.boolean().default(true),
        scheduleMonths: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
        include: {
          unit: { select: { buildingId: true } },
          rentPayments: { select: { id: true }, take: 1 },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      const updatedTenancy = await ctx.db.$transaction(async (tx) => {
        const updated = await tx.tenancy.update({
          where: { id: input.tenancyId },
          data: {
            leaseStartDate: input.leaseStartDate,
            leaseEndDate: input.leaseEndDate ?? null,
            rentAmountCents: input.rentAmountCents,
            rentFrequency: input.rentFrequency,
            bondAmountCents: input.bondAmountCents,
            moveInDate: input.moveInDate ?? input.leaseStartDate,
          },
        });

        if (input.createSchedule && tenancy.rentPayments.length === 0) {
          await tx.rentPayment.createMany({
            data: buildRentScheduleEntries({
              tenancyId: updated.id,
              leaseStartDate: input.leaseStartDate,
              rentFrequency: input.rentFrequency,
              rentAmountCents: input.rentAmountCents,
              months: input.scheduleMonths,
            }),
          });
        }

        return updated;
      });

      return updatedTenancy;
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
        tenancyId: t.id,
        unitNumber: t.unit.unitNumber,
        tenantName: `${t.user.firstName} ${t.user.lastName}`,
        rentAmountCents: t.rentAmountCents,
        rentFrequency: t.rentFrequency,
        leaseEnd: t.leaseEndDate,
        moveInDate: t.moveInDate,
        overduePayments: t.rentPayments.filter((p) => p.status === "OVERDUE").length,
        nextDue: t.rentPayments[0]?.dueDate ?? null,
      }));
    }),
});
