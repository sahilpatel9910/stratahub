import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { sendMaintenanceUpdateEmail } from "@/lib/email/send";
import { createNotification } from "@/server/trpc/lib/create-notification";
import {
  assertBuildingManagementAccess,
  hasBuildingManagementAccess,
} from "@/server/auth/building-access";

const categoryEnum = z.enum([
  "PLUMBING", "ELECTRICAL", "HVAC", "STRUCTURAL", "APPLIANCE",
  "PEST_CONTROL", "CLEANING", "SECURITY", "LIFT", "COMMON_AREA", "OTHER",
]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const statusEnum = z.enum([
  "SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "AWAITING_PARTS",
  "SCHEDULED", "COMPLETED", "CLOSED", "CANCELLED",
]);

export const maintenanceRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.maintenanceRequest.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          ...(input.status ? { status: input.status } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
        },
        include: {
          unit: { select: { unitNumber: true, buildingId: true } },
          requestedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { comments: true, images: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        select: { requestedById: true, unit: { select: { buildingId: true } } },
      });

      if (request.requestedById !== ctx.user!.id) {
        await assertBuildingManagementAccess(ctx.db, ctx.user!, request.unit.buildingId);
      }

      return ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          unit: { include: { building: true } },
          requestedBy: true,
          images: true,
          comments: {
            include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),

  create: tenantOrAboveProcedure
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
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });

      if (!hasBuildingManagementAccess(ctx.user!, unit.buildingId)) {
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
            message: "You do not have access to create a request for this unit.",
          });
        }
      }

      return ctx.db.maintenanceRequest.create({
        data: {
          ...input,
          requestedById: ctx.user!.id,
        },
      });
    }),

  updateStatus: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: statusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, existing.unit.buildingId);

      const data: Record<string, unknown> = { status: input.status };
      if (input.status === "COMPLETED") {
        data.completedDate = new Date();
      }

      const updated = await ctx.db.maintenanceRequest.update({
        where: { id: input.id },
        data,
        include: {
          requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          unit: { include: { building: { select: { name: true } } } },
        },
      });

      // Notify resident of meaningful status changes (fire-and-forget)
      const notifyStatuses = ["ACKNOWLEDGED", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"];
      if (notifyStatuses.includes(input.status)) {
        const { requestedBy, unit } = updated;
        void createNotification(ctx.db, {
          userId: requestedBy.id,
          type: "MAINTENANCE_STATUS_UPDATED",
          title: `Maintenance update: ${updated.title}`,
          body: `Status changed to ${input.status.replace(/_/g, " ")}`,
          linkUrl: "/resident/maintenance",
        });
        void sendMaintenanceUpdateEmail(requestedBy.email, {
          recipientName: `${requestedBy.firstName} ${requestedBy.lastName}`,
          buildingName: unit.building.name,
          unitNumber: unit.unitNumber,
          requestTitle: updated.title,
          newStatus: input.status,
        });
      }

      return updated;
    }),

  assign: managerProcedure
    .input(z.object({ id: z.string(), assignedTo: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, existing.unit.buildingId);

      return ctx.db.maintenanceRequest.update({
        where: { id: input.id },
        data: { assignedTo: input.assignedTo, status: "ACKNOWLEDGED" },
      });
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        maintenanceRequestId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.maintenanceRequestId },
        select: { requestedById: true, unit: { select: { buildingId: true } } },
      });

      if (request.requestedById !== ctx.user!.id) {
        await assertBuildingManagementAccess(ctx.db, ctx.user!, request.unit.buildingId);
      }

      return ctx.db.maintenanceComment.create({
        data: {
          ...input,
          userId: ctx.user!.id,
        },
      });
    }),
});
