import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
} from "@/server/trpc/trpc";
import { assertBuildingOperationsAccess } from "@/server/auth/building-access";
import { createNotification } from "@/server/trpc/lib/create-notification";

export const parcelsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: z.enum(["RECEIVED", "NOTIFIED", "COLLECTED", "RETURNED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.parcel.findMany({
        where: {
          buildingId: input.buildingId,
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          loggedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { loggedAt: "desc" },
      });
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        unitNumber: z.string().min(1),
        recipientName: z.string().min(1),
        carrier: z.string().optional(),
        trackingNumber: z.string().optional(),
        storageLocation: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      const parcel = await ctx.db.parcel.create({
        data: { ...input, loggedById: ctx.user!.id, status: "RECEIVED" },
      });

      // Notify matching unit residents (fire-and-forget)
      void ctx.db.unit.findFirst({
        where: { buildingId: input.buildingId, unitNumber: input.unitNumber },
        include: {
          ownerships: { where: { isActive: true }, select: { userId: true } },
          tenancies:  { where: { isActive: true }, select: { userId: true } },
        },
      }).then((unit) => {
        if (!unit) return;
        const seen = new Set<string>();
        const residents = [...unit.ownerships, ...unit.tenancies].filter(({ userId }) => {
          if (seen.has(userId)) return false;
          seen.add(userId);
          return true;
        });
        for (const { userId } of residents) {
          void createNotification(ctx.db, {
            userId,
            type: "PARCEL_RECEIVED",
            title: "A parcel has arrived for you",
            body: [
              input.carrier ? `From: ${input.carrier}` : null,
              input.storageLocation ? `Location: ${input.storageLocation}` : null,
            ].filter(Boolean).join(" · ") || "Contact reception to collect",
            linkUrl: "/resident",
          });
        }
      }).catch((err) => console.error("[notification] PARCEL_RECEIVED failed:", err));

      return parcel;
    }),

  markNotified: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const parcel = await ctx.db.parcel.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, parcel.buildingId);

      return ctx.db.parcel.update({
        where: { id: input.id },
        data: { status: "NOTIFIED" },
      });
    }),

  markCollected: managerProcedure
    .input(z.object({ id: z.string(), collectedBy: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const parcel = await ctx.db.parcel.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, parcel.buildingId);

      return ctx.db.parcel.update({
        where: { id: input.id },
        data: {
          status: "COLLECTED",
          collectedAt: new Date(),
          collectedBy: input.collectedBy,
        },
      });
    }),

  markReturned: managerProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const parcel = await ctx.db.parcel.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, parcel.buildingId);

      return ctx.db.parcel.update({
        where: { id: input.id },
        data: {
          status: "RETURNED",
          notes: input.notes,
          collectedAt: null,
          collectedBy: null,
        },
      });
    }),
});
