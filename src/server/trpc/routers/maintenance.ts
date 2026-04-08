import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";

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
  listByBuilding: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
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
      const data: Record<string, unknown> = { status: input.status };
      if (input.status === "COMPLETED") {
        data.completedDate = new Date();
      }
      return ctx.db.maintenanceRequest.update({
        where: { id: input.id },
        data,
      });
    }),

  assign: managerProcedure
    .input(z.object({ id: z.string(), assignedTo: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
      return ctx.db.maintenanceComment.create({
        data: {
          ...input,
          userId: ctx.user!.id,
        },
      });
    }),
});
