import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingAccess, assertBuildingManagementAccess } from "@/server/auth/building-access";

const purposeEnum = z.enum([
  "PERSONAL", "DELIVERY", "TRADESPERSON", "REAL_ESTATE", "INSPECTION", "OTHER",
]);

export const visitorsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        date: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const where: Record<string, unknown> = { buildingId: input.buildingId };

      if (input.date) {
        const day = new Date(input.date);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        where.createdAt = { gte: day, lt: nextDay };
      }

      return ctx.db.visitorEntry.findMany({
        where,
        include: {
          registeredBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: tenantOrAboveProcedure
    .input(
      z.object({
        buildingId: z.string(),
        visitorName: z.string().min(1, "Visitor name is required"),
        visitorPhone: z.string().optional(),
        visitorCompany: z.string().optional(),
        purpose: purposeEnum,
        unitToVisit: z.string().optional(),
        preApproved: z.boolean().default(false),
        vehiclePlate: z.string().optional(),
        deliveryInstructions: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.visitorEntry.create({
        data: { ...input, registeredById: ctx.user!.id },
      });
    }),

  logArrival: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const visitor = await ctx.db.visitorEntry.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, visitor.buildingId);

      return ctx.db.visitorEntry.update({
        where: { id: input.id },
        data: { arrivalTime: new Date() },
      });
    }),

  logDeparture: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const visitor = await ctx.db.visitorEntry.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, visitor.buildingId);

      return ctx.db.visitorEntry.update({
        where: { id: input.id },
        data: { departureTime: new Date() },
      });
    }),
});
