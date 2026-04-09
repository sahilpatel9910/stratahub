import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

const DOC_CATEGORIES = [
  "LEASE_AGREEMENT",
  "BUILDING_RULES",
  "STRATA_MINUTES",
  "FINANCIAL_REPORT",
  "INSURANCE",
  "COMPLIANCE",
  "NOTICE",
  "OTHER",
] as const;

export const documentsRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(),
        category: z.enum(DOC_CATEGORIES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.document.findMany({
        where: {
          buildingId: input.buildingId,
          ...(input.category ? { category: input.category } : {}),
        },
        include: {
          uploadedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.enum(DOC_CATEGORIES),
        fileUrl: z.string().url(),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string(),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.create({
        data: {
          ...input,
          uploadedById: ctx.user!.id,
        },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.delete({ where: { id: input.id } });
    }),
});
