import { z } from "zod";
import {
  buildingManagerProcedure,
  managerProcedure,
  createTRPCRouter,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingManagementAccess,
} from "@/server/auth/building-access";

const rentFrequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]);

export const tenancyRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.tenancy.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          unit: { select: { unitNumber: true } },
          _count: { select: { rentPayments: true } },
          rentPayments: {
            where: { status: { in: ["PENDING", "OVERDUE"] } },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          unit: { include: { building: { select: { name: true, suburb: true } } } },
          rentPayments: { orderBy: { dueDate: "desc" } },
          bondRecord: true,
        },
      });
    }),

  create: buildingManagerProcedure
    .input(
      z.object({
        unitId: z.string(),
        userId: z.string(),
        leaseStartDate: z.string().transform((s) => new Date(s)),
        leaseEndDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        rentAmountCents: z.number().int().positive(),
        rentFrequency: rentFrequencyEnum,
        bondAmountCents: z.number().int().min(0),
        moveInDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        generateSchedule: z.boolean().default(true),
        scheduleMonths: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, unit.buildingId);

      // Enforce one active tenancy per unit
      const existing = await ctx.db.tenancy.findFirst({
        where: { unitId: input.unitId, isActive: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This unit already has an active tenancy. End the existing tenancy first.",
        });
      }

      const { generateSchedule, scheduleMonths, ...tenancyData } = input;

      return ctx.db.$transaction(async (tx) => {
        const tenancy = await tx.tenancy.create({
          data: {
            ...tenancyData,
            leaseEndDate: input.leaseEndDate ?? null,
            moveInDate: input.moveInDate ?? input.leaseStartDate,
          },
        });

        if (generateSchedule) {
          const payments = buildSchedule({
            tenancyId: tenancy.id,
            leaseStartDate: tenancy.leaseStartDate,
            rentFrequency: tenancy.rentFrequency,
            rentAmountCents: tenancy.rentAmountCents,
            months: scheduleMonths,
            leaseEndDate: tenancy.leaseEndDate,
          });
          await tx.rentPayment.createMany({ data: payments });
        }

        return tenancy;
      });
    }),

  update: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        leaseStartDate: z.string().transform((s) => new Date(s)).optional(),
        leaseEndDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        rentAmountCents: z.number().int().positive().optional(),
        rentFrequency: rentFrequencyEnum.optional(),
        bondAmountCents: z.number().int().min(0).optional(),
        moveInDate: z.string().transform((s) => new Date(s)).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.update({ where: { id }, data });
    }),

  end: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        moveOutDate: z.string().transform((s) => new Date(s)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.update({
        where: { id: input.id },
        data: {
          isActive: false,
          moveOutDate: input.moveOutDate ?? new Date(),
        },
      });
    }),
});

// ── Shared schedule builder ───────────────────────────────────────────────────
function buildSchedule({
  tenancyId,
  leaseStartDate,
  rentFrequency,
  rentAmountCents,
  months,
  leaseEndDate,
}: {
  tenancyId: string;
  leaseStartDate: Date;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  rentAmountCents: number;
  months: number;
  leaseEndDate?: Date | null;
}) {
  const payments = [];
  const start = new Date(leaseStartDate);
  const count =
    rentFrequency === "WEEKLY" ? months * 4 :
    rentFrequency === "FORTNIGHTLY" ? months * 2 :
    months;

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(start);
    if (rentFrequency === "WEEKLY") dueDate.setDate(start.getDate() + i * 7);
    else if (rentFrequency === "FORTNIGHTLY") dueDate.setDate(start.getDate() + i * 14);
    else dueDate.setMonth(start.getMonth() + i);

    if (leaseEndDate && dueDate >= leaseEndDate) break;

    payments.push({ tenancyId, amountCents: rentAmountCents, dueDate, status: "PENDING" as const });
  }
  return payments;
}
