import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { sendMaintenanceUpdateEmail } from "@/lib/email/send";
import { createNotification } from "@/server/trpc/lib/create-notification";
import {
  assertBuildingOperationsAccess,
  assertBuildingManagementAccess,
  hasBuildingManagementAccess,
} from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";

const MAINTENANCE_BUCKET = "maintenance";

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
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

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
        await assertBuildingOperationsAccess(ctx.db, ctx.user!, request.unit.buildingId);
      }

      const result = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          unit: { include: { building: true } },
          requestedBy: true,
          images: { orderBy: { createdAt: "asc" } },
          comments: {
            include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Generate signed display URLs for all images (private bucket)
      let imagesWithUrls = result.images.map((img) => ({
        ...img,
        displayUrl: null as string | null,
      }));

      const paths = result.images
        .map((img) => img.storagePath ?? img.imageUrl)
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        try {
          const adminClient = createAdminClient();
          const { data } = await adminClient.storage
            .from(MAINTENANCE_BUCKET)
            .createSignedUrls(paths, 60 * 60); // 1-hour expiry

          if (data) {
            // Build a path→signedUrl map to avoid index mismatches when some
            // images have null storagePath (those were filtered out of `paths`)
            const urlByPath = new Map(
              data.map((d) => [d.path, d.signedUrl ?? null])
            );
            imagesWithUrls = result.images.map((img) => {
              const path = img.storagePath ?? img.imageUrl;
              return { ...img, displayUrl: path ? (urlByPath.get(path) ?? null) : null };
            });
          }
        } catch (err) {
          console.error("[maintenance] signed URL generation failed:", err);
        }
      }

      return { ...result, images: imagesWithUrls };
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

      const request = await ctx.db.maintenanceRequest.create({
        data: {
          ...input,
          requestedById: ctx.user!.id,
        },
        include: {
          unit: { select: { unitNumber: true } },
        },
      });

      // Notify all building managers + reception
      try {
        const managers = await ctx.db.buildingAssignment.findMany({
          where: {
            buildingId: unit.buildingId,
            isActive: true,
            role: { in: ["BUILDING_MANAGER", "RECEPTION"] },
          },
          select: { userId: true },
        });
        await Promise.all(
          managers.map(({ userId }) =>
            createNotification(ctx.db, {
              userId,
              type: "MAINTENANCE_CREATED",
              title: `New maintenance request: ${input.title}`,
              body: `Unit ${request.unit.unitNumber} — ${input.category.replace(/_/g, " ")}`,
              linkUrl: "/manager/maintenance",
            })
          )
        );
      } catch (err) {
        console.error("[notification] MAINTENANCE_CREATED failed:", err);
      }

      return request;
    }),

  updateStatus: buildingManagerProcedure
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

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, existing.unit.buildingId);

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

      // Notify resident of meaningful status changes
      const notifyStatuses = ["ACKNOWLEDGED", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"];
      if (notifyStatuses.includes(input.status)) {
        const { requestedBy, unit } = updated;
        await createNotification(ctx.db, {
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

  assign: buildingManagerProcedure
    .input(z.object({ id: z.string(), assignedTo: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.id },
        select: { status: true, unit: { select: { buildingId: true } } },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, existing.unit.buildingId);

      // Only advance to ACKNOWLEDGED if still at SUBMITTED — don't roll back progress
      const statusUpdate =
        existing.status === "SUBMITTED" ? { status: "ACKNOWLEDGED" as const } : {};

      return ctx.db.maintenanceRequest.update({
        where: { id: input.id },
        data: { assignedTo: input.assignedTo, ...statusUpdate },
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
        await assertBuildingOperationsAccess(ctx.db, ctx.user!, request.unit.buildingId);
      }

      return ctx.db.maintenanceComment.create({
        data: {
          ...input,
          userId: ctx.user!.id,
        },
      });
    }),

  addImage: protectedProcedure
    .input(
      z.object({
        maintenanceRequestId: z.string(),
        storagePath: z.string().min(1),
        caption: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.maintenanceRequest.findUniqueOrThrow({
        where: { id: input.maintenanceRequestId },
        select: { requestedById: true, unit: { select: { buildingId: true } } },
      });

      // Caller must be the requester or a building manager
      if (request.requestedById !== ctx.user!.id) {
        await assertBuildingManagementAccess(ctx.db, ctx.user!, request.unit.buildingId);
      }

      return ctx.db.maintenanceImage.create({
        data: {
          maintenanceRequestId: input.maintenanceRequestId,
          imageUrl: input.storagePath, // imageUrl holds the path; signed URL generated on getById
          storagePath: input.storagePath,
          caption: input.caption,
        },
      });
    }),

  deleteImage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.maintenanceImage.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          storagePath: true,
          imageUrl: true,
          maintenanceRequest: {
            select: { requestedById: true, unit: { select: { buildingId: true } } },
          },
        },
      });

      // Caller must be the requester or a building manager
      if (image.maintenanceRequest.requestedById !== ctx.user!.id) {
        await assertBuildingManagementAccess(
          ctx.db,
          ctx.user!,
          image.maintenanceRequest.unit.buildingId
        );
      }

      // Remove from Supabase Storage (best-effort)
      const path = image.storagePath ?? image.imageUrl;
      if (path) {
        try {
          const adminClient = createAdminClient();
          await adminClient.storage.from(MAINTENANCE_BUCKET).remove([path]);
        } catch (err) {
          console.error("[maintenance] storage image delete error:", err);
        }
      }

      return ctx.db.maintenanceImage.delete({ where: { id: input.id } });
    }),
});
