import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

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
});
