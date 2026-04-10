import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

const levyTypeEnum = z.enum(["ADMIN_FUND", "CAPITAL_WORKS", "SPECIAL_LEVY"]);
const paymentStatusEnum = z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"]);

export const strataRouter = createTRPCRouter({
  getByBuilding: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
        include: {
          levies: { orderBy: { dueDate: "desc" } },
          bylaws: { orderBy: { bylawNumber: "asc" } },
          meetings: { orderBy: { meetingDate: "desc" } },
        },
      });
    }),

  upsertInfo: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        strataPlanNumber: z.string().min(1),
        strataManagerName: z.string().optional(),
        strataManagerEmail: z.string().email().optional().or(z.literal("")),
        strataManagerPhone: z.string().optional(),
        adminFundBalance: z.number().int().optional(),
        capitalWorksBalance: z.number().int().optional(),
        insurancePolicyNo: z.string().optional(),
        insuranceExpiry: z.string().optional(),
        nextAgmDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { buildingId, insuranceExpiry, nextAgmDate, strataManagerEmail, ...rest } = input;

      const data = {
        ...rest,
        strataManagerEmail: strataManagerEmail || null,
        ...(insuranceExpiry ? { insuranceExpiry: new Date(insuranceExpiry) } : {}),
        ...(nextAgmDate ? { nextAgmDate: new Date(nextAgmDate) } : {}),
      };

      return ctx.db.strataInfo.upsert({
        where: { buildingId },
        create: { buildingId, ...data },
        update: data,
      });
    }),

  createMeeting: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        title: z.string().min(1),
        meetingDate: z.string(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strata info not set up for this building. Please configure strata details first.",
        });
      }

      return ctx.db.strataMeeting.create({
        data: {
          strataInfoId: strataInfo.id,
          title: input.title,
          meetingDate: new Date(input.meetingDate),
          location: input.location,
          notes: input.notes,
        },
      });
    }),

  deleteMeeting: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.strataMeeting.delete({ where: { id: input.id } });
    }),

  // ── Levies ────────────────────────────────────────────────────────────────

  listLevies: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: paymentStatusEnum.optional(),
        levyType: levyTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) return [];

      const levies = await ctx.db.strataLevy.findMany({
        where: {
          strataInfoId: strataInfo.id,
          ...(input.status ? { status: input.status } : {}),
          ...(input.levyType ? { levyType: input.levyType } : {}),
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      });

      // Attach unit numbers
      const unitIds = [...new Set(levies.map((l) => l.unitId))];
      const units = await ctx.db.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true },
      });
      const unitMap = Object.fromEntries(units.map((u) => [u.id, u.unitNumber]));

      return levies.map((l) => ({
        ...l,
        unitNumber: unitMap[l.unitId] ?? l.unitId,
      }));
    }),

  createLevy: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        unitId: z.string(),
        levyType: levyTypeEnum,
        amountCents: z.number().int().positive(),
        quarterStart: z.string(),
        dueDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Set up strata info for this building first.",
        });
      }

      return ctx.db.strataLevy.create({
        data: {
          strataInfoId: strataInfo.id,
          unitId: input.unitId,
          levyType: input.levyType,
          amountCents: input.amountCents,
          quarterStart: new Date(input.quarterStart),
          dueDate: new Date(input.dueDate),
        },
      });
    }),

  bulkCreateLevies: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        levyType: levyTypeEnum,
        amountCents: z.number().int().positive(),
        quarterStart: z.string(),
        dueDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Set up strata info for this building first.",
        });
      }

      const units = await ctx.db.unit.findMany({
        where: { buildingId: input.buildingId },
        select: { id: true },
      });

      if (units.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No units found for this building.",
        });
      }

      const result = await ctx.db.strataLevy.createMany({
        data: units.map((u) => ({
          strataInfoId: strataInfo.id,
          unitId: u.id,
          levyType: input.levyType,
          amountCents: input.amountCents,
          quarterStart: new Date(input.quarterStart),
          dueDate: new Date(input.dueDate),
        })),
      });

      return { count: result.count };
    }),

  updateLevyStatus: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: paymentStatusEnum,
        paidDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.strataLevy.update({
        where: { id: input.id },
        data: {
          status: input.status,
          paidDate:
            input.status === "PAID"
              ? input.paidDate
                ? new Date(input.paidDate)
                : new Date()
              : null,
        },
      });
    }),

  deleteLevy: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.strataLevy.delete({ where: { id: input.id } });
    }),
});
