import { z } from "zod";
import { createTRPCRouter, tenantOrAboveProcedure } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

const paymentStatusEnum = z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"]);
const maintenanceStatusEnum = z.enum([
  "SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "AWAITING_PARTS",
  "SCHEDULED", "COMPLETED", "CLOSED", "CANCELLED",
]);
const categoryEnum = z.enum([
  "PLUMBING", "ELECTRICAL", "HVAC", "STRUCTURAL", "APPLIANCE",
  "PEST_CONTROL", "CLEANING", "SECURITY", "LIFT", "COMMON_AREA", "OTHER",
]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const docCategoryEnum = z.enum([
  "LEASE_AGREEMENT", "BUILDING_RULES", "STRATA_MINUTES",
  "FINANCIAL_REPORT", "INSURANCE", "COMPLIANCE", "NOTICE", "OTHER",
]);

export const residentRouter = createTRPCRouter({
  // Current user profile with their units and building
  getMyProfile: tenantOrAboveProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.user!.id },
      include: {
        ownerships: {
          where: { isActive: true },
          include: { unit: { include: { building: true } } },
        },
        tenancies: {
          where: { isActive: true },
          include: { unit: { include: { building: true } } },
        },
        buildingAssignments: {
          where: { isActive: true },
          include: { building: true },
        },
      },
    });
  }),

  // The primary building for this resident
  getMyBuilding: tenantOrAboveProcedure.query(async ({ ctx }) => {
    // Try ownership first, then tenancy, then assignment
    const ownership = await ctx.db.ownership.findFirst({
      where: { userId: ctx.user!.id, isActive: true },
      include: { unit: { include: { building: true } } },
    });
    if (ownership) return ownership.unit.building;

    const tenancy = await ctx.db.tenancy.findFirst({
      where: { userId: ctx.user!.id, isActive: true },
      include: { unit: { include: { building: true } } },
    });
    if (tenancy) return tenancy.unit.building;

    const assignment = await ctx.db.buildingAssignment.findFirst({
      where: { userId: ctx.user!.id, isActive: true },
      include: { building: true },
    });
    return assignment?.building ?? null;
  }),

  // Levies for this resident's owned units
  getMyLevies: tenantOrAboveProcedure
    .input(z.object({ status: paymentStatusEnum.optional() }))
    .query(async ({ ctx, input }) => {
      const ownerships = await ctx.db.ownership.findMany({
        where: { userId: ctx.user!.id, isActive: true },
        select: { unitId: true },
      });
      const unitIds = ownerships.map((o) => o.unitId);
      if (unitIds.length === 0) return [];

      const levies = await ctx.db.strataLevy.findMany({
        where: {
          unitId: { in: unitIds },
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      });

      // Attach unit numbers
      const units = await ctx.db.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true },
      });
      const unitMap = Object.fromEntries(units.map((u) => [u.id, u.unitNumber]));

      return levies.map((l) => ({ ...l, unitNumber: unitMap[l.unitId] ?? l.unitId }));
    }),

  // Maintenance requests submitted by this resident
  getMyMaintenanceRequests: tenantOrAboveProcedure
    .input(z.object({ status: maintenanceStatusEnum.optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.maintenanceRequest.findMany({
        where: {
          requestedById: ctx.user!.id,
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          unit: { select: { unitNumber: true, buildingId: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Submit a new maintenance request
  createMaintenanceRequest: tenantOrAboveProcedure
    .input(
      z.object({
        unitId: z.string(),
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        category: categoryEnum,
        priority: priorityEnum.default("MEDIUM"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the resident actually belongs to this unit
      const [ownership, tenancy] = await Promise.all([
        ctx.db.ownership.findFirst({
          where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true },
        }),
        ctx.db.tenancy.findFirst({
          where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true },
        }),
      ]);
      if (!ownership && !tenancy) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this unit.",
        });
      }
      return ctx.db.maintenanceRequest.create({
        data: {
          ...input,
          requestedById: ctx.user!.id,
        },
      });
    }),

  // Public documents for this resident's building
  getMyDocuments: tenantOrAboveProcedure
    .input(z.object({ category: docCategoryEnum.optional() }))
    .query(async ({ ctx, input }) => {
      // Find building via ownership or tenancy
      const ownership = await ctx.db.ownership.findFirst({
        where: { userId: ctx.user!.id, isActive: true },
        include: { unit: { select: { buildingId: true } } },
      });
      const tenancy = !ownership
        ? await ctx.db.tenancy.findFirst({
            where: { userId: ctx.user!.id, isActive: true },
            include: { unit: { select: { buildingId: true } } },
          })
        : null;

      const buildingId = ownership?.unit.buildingId ?? tenancy?.unit.buildingId;
      if (!buildingId) return [];

      return ctx.db.document.findMany({
        where: {
          buildingId,
          isPublic: true,
          ...(input.category ? { category: input.category } : {}),
        },
        include: {
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Announcements for this resident's building
  getMyAnnouncements: tenantOrAboveProcedure.query(async ({ ctx }) => {
    const ownership = await ctx.db.ownership.findFirst({
      where: { userId: ctx.user!.id, isActive: true },
      include: { unit: { select: { buildingId: true } } },
    });
    const tenancy = !ownership
      ? await ctx.db.tenancy.findFirst({
          where: { userId: ctx.user!.id, isActive: true },
          include: { unit: { select: { buildingId: true } } },
        })
      : null;

    const buildingId = ownership?.unit.buildingId ?? tenancy?.unit.buildingId;
    if (!buildingId) return [];

    return ctx.db.announcement.findMany({
      where: {
        buildingId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
