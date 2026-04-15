import { z } from "zod";
import {
  createTRPCRouter,
  superAdminProcedure,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingAccess, assertBuildingManagementAccess } from "@/server/auth/building-access";

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
      await assertBuildingAccess(ctx.db, ctx.user!, input.id);

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
      await assertBuildingManagementAccess(ctx.db, ctx.user!, id);
      return ctx.db.building.update({ where: { id }, data });
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.building.delete({ where: { id: input.id } });
    }),

  getTrends: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return {
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" }),
        };
      });

      const [maintenanceRequests, parcels, rentPayments, newResidents] =
        await Promise.all([
          ctx.db.maintenanceRequest.findMany({
            where: {
              unit: { buildingId: input.buildingId },
              createdAt: { gte: sixMonthsAgo },
            },
            select: { createdAt: true },
          }),
          ctx.db.parcel.findMany({
            where: {
              buildingId: input.buildingId,
              createdAt: { gte: sixMonthsAgo },
            },
            select: { createdAt: true },
          }),
          ctx.db.rentPayment.findMany({
            where: {
              tenancy: { unit: { buildingId: input.buildingId } },
              status: "PAID",
              paidDate: { gte: sixMonthsAgo },
            },
            select: { paidDate: true, amountCents: true },
          }),
          ctx.db.buildingAssignment.findMany({
            where: {
              buildingId: input.buildingId,
              role: { in: ["OWNER", "TENANT"] },
              createdAt: { gte: sixMonthsAgo },
            },
            select: { createdAt: true },
          }),
        ]);

      function monthKey(date: Date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      const maintenanceByMonth = new Map<string, number>();
      const parcelsByMonth = new Map<string, number>();
      const rentByMonth = new Map<string, number>();
      const residentsByMonth = new Map<string, number>();

      for (const { key } of months) {
        maintenanceByMonth.set(key, 0);
        parcelsByMonth.set(key, 0);
        rentByMonth.set(key, 0);
        residentsByMonth.set(key, 0);
      }

      for (const m of maintenanceRequests) {
        const k = monthKey(m.createdAt);
        if (maintenanceByMonth.has(k))
          maintenanceByMonth.set(k, (maintenanceByMonth.get(k) ?? 0) + 1);
      }
      for (const p of parcels) {
        const k = monthKey(p.createdAt);
        if (parcelsByMonth.has(k))
          parcelsByMonth.set(k, (parcelsByMonth.get(k) ?? 0) + 1);
      }
      for (const r of rentPayments) {
        if (!r.paidDate) continue;
        const k = monthKey(r.paidDate);
        if (rentByMonth.has(k))
          rentByMonth.set(k, (rentByMonth.get(k) ?? 0) + r.amountCents);
      }
      for (const a of newResidents) {
        const k = monthKey(a.createdAt);
        if (residentsByMonth.has(k))
          residentsByMonth.set(k, (residentsByMonth.get(k) ?? 0) + 1);
      }

      return months.map(({ key, label }) => ({
        month: label,
        maintenanceRequests: maintenanceByMonth.get(key) ?? 0,
        parcelsReceived: parcelsByMonth.get(key) ?? 0,
        rentCollectedCents: rentByMonth.get(key) ?? 0,
        newResidents: residentsByMonth.get(key) ?? 0,
      }));
    }),

  getStats: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

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
        keysToRotate,
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
        ctx.db.keyRecord.count({
          where: {
            unit: { buildingId: input.buildingId },
            isActive: true,
            rotationDue: { lte: now },
          },
        }),
      ]);

      return {
        totalUnits,
        occupiedUnits,
        residentCount,
        openMaintenanceCount,
        pendingParcelCount,
        overdueRentCount,
        keysToRotate,
        rentCollectedThisMonthCents: rentThisMonth._sum.amountCents ?? 0,
        occupancyRate:
          totalUnits > 0
            ? Math.round((occupiedUnits / totalUnits) * 1000) / 10
            : 0,
      };
    }),
});
