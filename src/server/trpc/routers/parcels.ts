import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

export const parcelsRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: z.enum(["RECEIVED", "NOTIFIED", "COLLECTED", "RETURNED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
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
      return ctx.db.parcel.create({
        data: { ...input, loggedById: ctx.user!.id, status: "RECEIVED" },
      });
    }),

  markNotified: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.parcel.update({
        where: { id: input.id },
        data: { status: "NOTIFIED" },
      });
    }),

  markCollected: managerProcedure
    .input(z.object({ id: z.string(), collectedBy: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
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
      return ctx.db.parcel.update({
        where: { id: input.id },
        data: { status: "RETURNED", notes: input.notes },
      });
    }),
});
