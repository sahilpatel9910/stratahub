import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

const keyTypeEnum = z.enum(["PHYSICAL_KEY", "FOB", "ACCESS_CODE", "REMOTE", "SWIPE_CARD"]);

export const keysRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.keyRecord.findMany({
        where: { buildingId: input.buildingId },
        include: {
          unit: { select: { unitNumber: true } },
          logs: { orderBy: { timestamp: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
