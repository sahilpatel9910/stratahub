import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingAccess,
  assertBuildingManagementAccess,
  isSuperAdmin,
} from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";

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
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        category: z.enum(DOC_CATEGORIES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

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
        fileUrl: z.string().url().optional(),
        storagePath: z.string(),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string(),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      if (!input.storagePath.startsWith(`${input.buildingId}/`)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Storage path does not match the selected building.",
        });
      }

      return ctx.db.document.create({
        data: {
          ...input,
          fileUrl: input.fileUrl ?? input.storagePath,
          uploadedById: ctx.user!.id,
        },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.document.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          buildingId: true,
          tenancyId: true,
          storagePath: true,
        },
      });

      let buildingId = document.buildingId;

      if (!buildingId && document.tenancyId) {
        const tenancy = await ctx.db.tenancy.findUnique({
          where: { id: document.tenancyId },
          select: { unit: { select: { buildingId: true } } },
        });
        buildingId = tenancy?.unit.buildingId ?? null;
      }

      if (!buildingId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unable to determine which building owns this document.",
        });
      }

      await assertBuildingManagementAccess(ctx.db, ctx.user!, buildingId);

      if (document.storagePath) {
        const adminClient = createAdminClient();
        const { error } = await adminClient.storage.from("documents").remove([document.storagePath]);
        if (error) {
          console.error("Document storage delete error:", error);
        }
      }

      return ctx.db.document.delete({ where: { id: input.id } });
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.document.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          fileUrl: true,
          storagePath: true,
          isPublic: true,
          buildingId: true,
          tenancyId: true,
        },
      });

      let buildingId = document.buildingId;
      let tenancyUserId: string | null = null;

      if (document.tenancyId) {
        const tenancy = await ctx.db.tenancy.findUnique({
          where: { id: document.tenancyId },
          select: {
            userId: true,
            unit: { select: { buildingId: true } },
          },
        });
        tenancyUserId = tenancy?.userId ?? null;
        buildingId = buildingId ?? tenancy?.unit.buildingId ?? null;
      }

      if (tenancyUserId && tenancyUserId === ctx.user!.id) {
        // Tenancy-linked document owned by the caller.
      } else if (document.isPublic && buildingId) {
        await assertBuildingAccess(ctx.db, ctx.user!, buildingId);
      } else if (buildingId) {
        await assertBuildingManagementAccess(ctx.db, ctx.user!, buildingId);
      } else if (!isSuperAdmin(ctx.user!)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to access this document.",
        });
      }

      if (!document.storagePath) {
        return { url: document.fileUrl };
      }

      const adminClient = createAdminClient();
      const { data, error } = await adminClient.storage
        .from("documents")
        .createSignedUrl(document.storagePath, 60 * 5);

      if (error || !data?.signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Unable to create a download link.",
        });
      }

      return { url: data.signedUrl };
    }),
});
