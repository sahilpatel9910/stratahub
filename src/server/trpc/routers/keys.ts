import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingManagementAccess } from "@/server/auth/building-access";

const keyTypeEnum = z.enum(["PHYSICAL_KEY", "FOB", "ACCESS_CODE", "REMOTE", "SWIPE_CARD"]);

export const keysRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.keyRecord.findMany({
        where: { buildingId: input.buildingId },
        include: {
          unit: { select: { unitNumber: true } },
          logs: { orderBy: { timestamp: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const keyRecord = await ctx.db.keyRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, keyRecord.buildingId);

      return ctx.db.keyRecord.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          unit: true,
          building: true,
          logs: {
            include: { performedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { timestamp: "desc" },
          },
        },
      });
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        unitId: z.string().optional(),
        keyType: keyTypeEnum,
        identifier: z.string().min(1, "Identifier is required"),
        issuedTo: z.string().optional(),
        issuedDate: z.string().transform((s) => new Date(s)).optional(),
        rotationDue: z.string().transform((s) => new Date(s)).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      if (input.unitId) {
        const unit = await ctx.db.unit.findUniqueOrThrow({
          where: { id: input.unitId },
          select: { buildingId: true },
        });
        if (unit.buildingId !== input.buildingId) {
          throw new Error("Selected unit does not belong to this building.");
        }
      }

      const keyRecord = await ctx.db.keyRecord.create({ data: input });

      await ctx.db.keyLog.create({
        data: {
          keyRecordId: keyRecord.id,
          action: "CREATED",
          performedById: ctx.user!.id,
          notes: input.issuedTo ? `Issued to ${input.issuedTo}` : "Key record created",
        },
      });

      return keyRecord;
    }),

  issue: managerProcedure
    .input(
      z.object({
        id: z.string(),
        issuedTo: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.keyRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, existing.buildingId);

      const keyRecord = await ctx.db.keyRecord.update({
        where: { id: input.id },
        data: {
          issuedTo: input.issuedTo,
          issuedDate: new Date(),
          returnedDate: null,
          isActive: true,
        },
      });

      await ctx.db.keyLog.create({
        data: {
          keyRecordId: input.id,
          action: "ISSUED",
          performedById: ctx.user!.id,
          notes: `Issued to ${input.issuedTo}`,
        },
      });

      return keyRecord;
    }),

  returnKey: managerProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.keyRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, existing.buildingId);

      const keyRecord = await ctx.db.keyRecord.update({
        where: { id: input.id },
        data: { returnedDate: new Date() },
      });

      await ctx.db.keyLog.create({
        data: {
          keyRecordId: input.id,
          action: "RETURNED",
          performedById: ctx.user!.id,
          notes: input.notes,
        },
      });

      return keyRecord;
    }),

  deactivate: managerProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.keyRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, existing.buildingId);

      const keyRecord = await ctx.db.keyRecord.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await ctx.db.keyLog.create({
        data: {
          keyRecordId: input.id,
          action: "DEACTIVATED",
          performedById: ctx.user!.id,
          notes: input.notes,
        },
      });

      return keyRecord;
    }),
});
