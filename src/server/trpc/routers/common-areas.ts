import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
  buildingManagerProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";
import {
  assertBuildingAccess,
  assertBuildingManagementAccess,
  assertBuildingOperationsAccess,
  hasBuildingManagementAccess,
} from "@/server/auth/building-access";

export const commonAreasRouter = createTRPCRouter({
  // List all common areas for a building (any user with building access)
  listByBuilding: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingAccess(ctx.db, ctx.user!, input.buildingId);
      return ctx.db.commonArea.findMany({
        where: { buildingId: input.buildingId },
        orderBy: { name: "asc" },
      });
    }),

  // Create a new common area (building managers only)
  create: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        bookingRequired: z.boolean().default(false),
        operatingHours: z.string().optional(),
        floor: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);
      return ctx.db.commonArea.create({
        data: {
          buildingId: input.buildingId,
          name: input.name,
          description: input.description ?? null,
          capacity: input.capacity ?? null,
          bookingRequired: input.bookingRequired,
          operatingHours: input.operatingHours ?? null,
          floor: input.floor ?? null,
        },
      });
    }),

  // Update a common area (building managers only)
  update: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        capacity: z.number().int().positive().nullable().optional(),
        bookingRequired: z.boolean().optional(),
        operatingHours: z.string().nullable().optional(),
        floor: z.number().int().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const area = await ctx.db.commonArea.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, area.buildingId);
      const { id, ...fields } = input;
      return ctx.db.commonArea.update({ where: { id }, data: fields });
    }),

  // Delete a common area (building managers only)
  delete: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const area = await ctx.db.commonArea.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, area.buildingId);
      return ctx.db.commonArea.delete({ where: { id: input.id } });
    }),

  // Create a booking (any resident or above — tenantOrAbove)
  createBooking: tenantOrAboveProcedure
    .input(
      z.object({
        commonAreaId: z.string(),
        startTime: z.string(), // ISO datetime string
        endTime: z.string(),   // ISO datetime string
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const area = await ctx.db.commonArea.findUniqueOrThrow({
        where: { id: input.commonAreaId },
        select: { buildingId: true, isActive: true },
      });
      if (!area.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This facility is not currently available.",
        });
      }
      await assertBuildingAccess(ctx.db, ctx.user!, area.buildingId);
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);
      if (endTime <= startTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }
      return ctx.db.commonAreaBooking.create({
        data: {
          commonAreaId: input.commonAreaId,
          userId: ctx.user!.id,
          startTime,
          endTime,
          notes: input.notes ?? null,
        },
      });
    }),

  // List confirmed bookings for a single common area (optional date filter)
  listBookings: protectedProcedure
    .input(
      z.object({
        commonAreaId: z.string(),
        date: z.string().optional(), // "YYYY-MM-DD" filters to that day
      })
    )
    .query(async ({ ctx, input }) => {
      const area = await ctx.db.commonArea.findUniqueOrThrow({
        where: { id: input.commonAreaId },
        select: { buildingId: true },
      });
      await assertBuildingAccess(ctx.db, ctx.user!, area.buildingId);

      let dateFilter = {};
      if (input.date) {
        const day = new Date(input.date);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        dateFilter = { startTime: { gte: day, lt: nextDay } };
      }

      return ctx.db.commonAreaBooking.findMany({
        where: { commonAreaId: input.commonAreaId, status: "CONFIRMED", ...dateFilter },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { startTime: "asc" },
      });
    }),

  // List ALL bookings for a building (manager view)
  listBuildingBookings: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);
      return ctx.db.commonAreaBooking.findMany({
        where: { commonArea: { buildingId: input.buildingId } },
        include: {
          commonArea: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startTime: "asc" },
      });
    }),

  // Cancel a booking — own bookings only; managers can cancel any
  cancelBooking: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.commonAreaBooking.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          userId: true,
          status: true,
          commonArea: { select: { buildingId: true } },
        },
      });
      if (booking.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Booking is already cancelled." });
      }
      const isOwn = booking.userId === ctx.user!.id;
      const isManager = hasBuildingManagementAccess(ctx.user!, booking.commonArea.buildingId);
      if (!isOwn && !isManager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only cancel your own bookings." });
      }
      return ctx.db.commonAreaBooking.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
    }),
});
