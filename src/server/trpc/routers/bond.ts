import { z } from "zod";
import { createTRPCRouter, managerProcedure } from "@/server/trpc/trpc";
import { assertBuildingOperationsAccess } from "@/server/auth/building-access";
import { BOND_LODGEMENT_AUTHORITIES, BOND_LODGEMENT_DEADLINES_DAYS } from "@/lib/constants";

const AUSTRALIAN_STATE = z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
const BOND_STATUS = z.enum(["PENDING", "LODGED", "PARTIALLY_RELEASED", "FULLY_RELEASED", "DISPUTED"]);

export const bondRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.bondRecord.findMany({
        where: {
          tenancy: { unit: { buildingId: input.buildingId }, isActive: true },
        },
        include: {
          tenancy: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              unit: { select: { unitNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  upsert: managerProcedure
    .input(
      z.object({
        tenancyId: z.string(),
        amountCents: z.number().int().positive(),
        // lodgementAuthority is derived server-side from state — not accepted from client
        state: AUSTRALIAN_STATE,
        lodgementDate: z.string().optional(), // ISO date string e.g. "2024-01-15"
        referenceNumber: z.string().optional(),
        status: BOND_STATUS,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.tenancyId },
        select: {
          moveInDate: true,
          createdAt: true,
          unit: { select: { buildingId: true } },
        },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      // Authority is always determined server-side from state — clients cannot override it
      const lodgementAuthority = BOND_LODGEMENT_AUTHORITIES[input.state];

      // Deadline is measured from bond receipt date (move-in date, or tenancy creation
      // if move-in is unknown) — not from the lodgement date itself.
      const receiptBase = tenancy.moveInDate ?? tenancy.createdAt;
      const deadlineDays = BOND_LODGEMENT_DEADLINES_DAYS[input.state] ?? 10;
      const lodgementDeadline = new Date(receiptBase);
      lodgementDeadline.setDate(lodgementDeadline.getDate() + deadlineDays);

      const data = {
        amountCents: input.amountCents,
        lodgementAuthority,
        state: input.state,
        lodgementDate: input.lodgementDate ? new Date(input.lodgementDate) : null,
        lodgementDeadline,
        referenceNumber: input.referenceNumber ?? null,
        status: input.status,
        notes: input.notes ?? null,
      };

      return ctx.db.bondRecord.upsert({
        where: { tenancyId: input.tenancyId },
        create: { tenancyId: input.tenancyId, ...data },
        update: data,
      });
    }),

  updateStatus: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: BOND_STATUS,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bond = await ctx.db.bondRecord.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          tenancy: { select: { unit: { select: { buildingId: true } } } },
        },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, bond.tenancy.unit.buildingId);

      return ctx.db.bondRecord.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
    }),
});
