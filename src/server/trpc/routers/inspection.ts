import { z } from "zod";
import { createTRPCRouter, managerProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingOperationsAccess,
  hasBuildingOperationsAccess,
} from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/server/trpc/lib/create-notification";

const INSPECTION_BUCKET = "inspections";

const typeEnum = z.enum(["ROUTINE", "ENTRY", "EXIT", "EMERGENCY"]);
const statusEnum = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]);
const itemStatusEnum = z.enum(["PASS", "FAIL", "NA"]);

export const inspectionRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: statusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.inspection.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          unit: { select: { unitNumber: true } },
          inspectedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { rooms: true, images: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
    }),

  listByUnit: protectedProcedure
    .input(z.object({ unitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });

      if (!hasBuildingOperationsAccess(ctx.user!, unit.buildingId)) {
        const [ownership, tenancy] = await Promise.all([
          ctx.db.ownership.findFirst({ where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true } }),
          ctx.db.tenancy.findFirst({ where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true } }),
        ]);
        if (!ownership && !tenancy) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
        }
      }

      return ctx.db.inspection.findMany({
        where: { unitId: input.unitId },
        include: {
          inspectedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { rooms: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, inspection.unit.buildingId);

      const result = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          unit: { include: { building: { select: { name: true, suburb: true } } } },
          inspectedBy: { select: { firstName: true, lastName: true } },
          rooms: {
            include: { items: { orderBy: { id: "asc" } } },
            orderBy: { order: "asc" },
          },
          images: { orderBy: { createdAt: "asc" } },
        },
      });

      const paths = result.images.map((img) => img.storagePath).filter(Boolean);
      let imagesWithUrls = result.images.map((img) => ({ ...img, displayUrl: null as string | null }));

      if (paths.length > 0) {
        try {
          const admin = createAdminClient();
          const { data } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, 3600);
          if (data) {
            const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl ?? null]));
            imagesWithUrls = result.images.map((img) => ({
              ...img,
              displayUrl: urlByPath.get(img.storagePath) ?? null,
            }));
          }
        } catch (err) {
          console.error("[inspection] signed URL error:", err);
        }
      }

      return { ...result, images: imagesWithUrls };
    }),

  create: managerProcedure
    .input(
      z.object({
        unitId: z.string(),
        type: typeEnum,
        scheduledAt: z.string().transform((s) => new Date(s)),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, unit.buildingId);

      const inspection = await ctx.db.inspection.create({
        data: { ...input, inspectedById: ctx.user!.id },
        include: { unit: { select: { unitNumber: true } } },
      });

      try {
        const [ownerships, tenancies] = await Promise.all([
          ctx.db.ownership.findMany({ where: { unitId: input.unitId, isActive: true }, select: { userId: true } }),
          ctx.db.tenancy.findMany({ where: { unitId: input.unitId, isActive: true }, select: { userId: true } }),
        ]);
        const userIds = [...new Set([...ownerships, ...tenancies].map((r) => r.userId))];
        await Promise.all(
          userIds.map((userId) =>
            createNotification(ctx.db, {
              userId,
              type: "MAINTENANCE_STATUS_UPDATED",
              title: `Inspection scheduled for Unit ${inspection.unit.unitNumber}`,
              body: `${input.type} inspection on ${new Date(input.scheduledAt).toLocaleDateString("en-AU")}`,
              linkUrl: "/resident/inspections",
            })
          )
        );
      } catch (err) {
        console.error("[inspection] notification error:", err);
      }

      return inspection;
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.string().transform((s) => new Date(s)).optional(),
        notes: z.string().optional(),
        type: typeEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({ where: { id }, data });
    }),

  cancel: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),

  complete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({
        where: { id: input.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }),

  addRoom: managerProcedure
    .input(z.object({ inspectionId: z.string(), name: z.string().min(1), order: z.number().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.inspectionId },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspectionRoom.create({ data: input });
    }),

  updateRoom: managerProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), order: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionRoom.update({ where: { id }, data });
    }),

  deleteRoom: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id: input.id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionRoom.delete({ where: { id: input.id } });
    }),

  addItem: managerProcedure
    .input(z.object({ roomId: z.string(), label: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id: input.roomId },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.create({ data: { roomId: input.roomId, label: input.label } });
    }),

  updateItem: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: itemStatusEnum.optional(),
        note: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await ctx.db.inspectionItem.findUniqueOrThrow({
        where: { id },
        include: {
          room: { include: { inspection: { select: { unit: { select: { buildingId: true } } } } } },
        },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, item.room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.update({ where: { id }, data });
    }),

  deleteItem: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.inspectionItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          room: { include: { inspection: { select: { unit: { select: { buildingId: true } } } } } },
        },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, item.room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.delete({ where: { id: input.id } });
    }),

  addImage: managerProcedure
    .input(z.object({ inspectionId: z.string(), storagePath: z.string().min(1), caption: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.inspectionId },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspectionImage.create({ data: input });
    }),

  deleteImage: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.inspectionImage.findUniqueOrThrow({
        where: { id: input.id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, image.inspection.unit.buildingId);

      try {
        const admin = createAdminClient();
        await admin.storage.from(INSPECTION_BUCKET).remove([image.storagePath]);
      } catch (err) {
        console.error("[inspection] storage delete error:", err);
      }

      return ctx.db.inspectionImage.delete({ where: { id: input.id } });
    }),
});
