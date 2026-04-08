import { z } from "zod";
import {
  createTRPCRouter,
  superAdminProcedure,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

const stateEnum = z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

export const buildingsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ organisationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.organisationId) {
        where.organisationId = input.organisationId;
      }

      // Non-super-admins only see buildings they're assigned to
      const userRoles = ctx.user!.orgMemberships.map((m) => m.role);
      if (!userRoles.includes("SUPER_ADMIN")) {
        const assignedBuildingIds = ctx.user!.buildingAssignments.map(
          (a) => a.buildingId
        );
        where.id = { in: assignedBuildingIds };
      }

      return ctx.db.building.findMany({
        where,
        include: {
          organisation: { select: { name: true } },
          _count: { select: { units: true, assignments: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.building.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          organisation: true,
          units: {
            include: {
              ownerships: { include: { user: true } },
              tenancies: { where: { isActive: true }, include: { user: true } },
            },
            orderBy: { unitNumber: "asc" },
          },
          floors: { orderBy: { number: "asc" } },
          strataInfo: true,
          _count: {
            select: { units: true, assignments: true, announcements: true },
          },
        },
      });
    }),

  create: superAdminProcedure
    .input(
      z.object({
        organisationId: z.string(),
        name: z.string().min(1, "Building name is required"),
        address: z.string().min(1, "Address is required"),
        suburb: z.string().min(1, "Suburb is required"),
        state: stateEnum,
        postcode: z.string().min(4).max(4),
        totalFloors: z.number().int().min(1),
        totalUnits: z.number().int().min(1),
        strataSchemeNo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.building.create({ data: input });
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        suburb: z.string().min(1).optional(),
        state: stateEnum.optional(),
        postcode: z.string().min(4).max(4).optional(),
        totalFloors: z.number().int().min(1).optional(),
        totalUnits: z.number().int().min(1).optional(),
        strataSchemeNo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.building.update({ where: { id }, data });
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.building.delete({ where: { id: input.id } });
    }),

  getStats: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalUnits,
        occupiedUnits,
        residentCount,
        openMaintenanceCount,
        pendingParcelCount,
        overdueRentCount,
        rentThisMonth,
      ] = await Promise.all([
        ctx.db.unit.count({ where: { buildingId: input.buildingId } }),
        ctx.db.unit.count({ where: { buildingId: input.buildingId, isOccupied: true } }),
        ctx.db.buildingAssignment.count({
          where: {
            buildingId: input.buildingId,
            isActive: true,
            role: { in: ["OWNER", "TENANT"] },
          },
        }),
        ctx.db.maintenanceRequest.count({
          where: {
            unit: { buildingId: input.buildingId },
            status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
          },
        }),
        ctx.db.parcel.count({
          where: {
            buildingId: input.buildingId,
            status: { in: ["RECEIVED", "NOTIFIED"] },
          },
        }),
        ctx.db.rentPayment.count({
          where: {
            tenancy: { unit: { buildingId: input.buildingId }, isActive: true },
            status: "OVERDUE",
          },
        }),
        ctx.db.rentPayment.aggregate({
          where: {
            tenancy: { unit: { buildingId: input.buildingId }, isActive: true },
            status: "PAID",
            paidDate: { gte: startOfMonth },
          },
          _sum: { amountCents: true },
        }),
      ]);

      return {
        totalUnits,
        occupiedUnits,
        residentCount,
        openMaintenanceCount,
        pendingParcelCount,
        overdueRentCount,
        rentCollectedThisMonthCents: rentThisMonth._sum.amountCents ?? 0,
        occupancyRate:
          totalUnits > 0
            ? Math.round((occupiedUnits / totalUnits) * 1000) / 10
            : 0,
      };
    }),
});
