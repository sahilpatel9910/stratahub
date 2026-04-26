import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
  managerProcedure,
  ownerProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { sendLevyNoticeEmail } from "@/lib/email/send";
import { getStripe } from "@/lib/stripe/client";
import { createNotification } from "@/server/trpc/lib/create-notification";
import {
  assertBuildingManagementAccess,
  assertBuildingOperationsAccess,
} from "@/server/auth/building-access";

const levyTypeEnum = z.enum(["ADMIN_FUND", "CAPITAL_WORKS", "SPECIAL_LEVY"]);
const paymentStatusEnum = z.enum(["PENDING", "PAID", "OVERDUE", "PARTIAL", "WAIVED"]);

export const strataRouter = createTRPCRouter({
  getByBuilding: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
        include: {
          levies: { orderBy: { dueDate: "desc" } },
          bylaws: { orderBy: { bylawNumber: "asc" } },
          meetings: { orderBy: { meetingDate: "desc" } },
        },
      });
    }),

  upsertInfo: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        strataPlanNumber: z.string().min(1),
        strataManagerName: z.string().optional(),
        strataManagerEmail: z.string().email().optional().or(z.literal("")),
        strataManagerPhone: z.string().optional(),
        adminFundBalance: z.number().int().optional(),
        capitalWorksBalance: z.number().int().optional(),
        insurancePolicyNo: z.string().optional(),
        insuranceExpiry: z.string().optional(),
        nextAgmDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const { buildingId, insuranceExpiry, nextAgmDate, strataManagerEmail, ...rest } = input;

      const data = {
        ...rest,
        strataManagerEmail: strataManagerEmail || null,
        ...(insuranceExpiry ? { insuranceExpiry: new Date(insuranceExpiry) } : {}),
        ...(nextAgmDate ? { nextAgmDate: new Date(nextAgmDate) } : {}),
      };

      return ctx.db.strataInfo.upsert({
        where: { buildingId },
        create: { buildingId, ...data },
        update: data,
      });
    }),

  createMeeting: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        title: z.string().min(1),
        meetingDate: z.string(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strata info not set up for this building. Please configure strata details first.",
        });
      }

      return ctx.db.strataMeeting.create({
        data: {
          strataInfoId: strataInfo.id,
          title: input.title,
          meetingDate: new Date(input.meetingDate),
          location: input.location,
          notes: input.notes,
        },
      });
    }),

  deleteMeeting: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.strataMeeting.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          strataInfo: { select: { buildingId: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, meeting.strataInfo.buildingId);

      return ctx.db.strataMeeting.delete({ where: { id: input.id } });
    }),

  // ── Levies ────────────────────────────────────────────────────────────────

  listLevies: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: paymentStatusEnum.optional(),
        levyType: levyTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) return [];

      const levies = await ctx.db.strataLevy.findMany({
        where: {
          strataInfoId: strataInfo.id,
          ...(input.status ? { status: input.status } : {}),
          ...(input.levyType ? { levyType: input.levyType } : {}),
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      });

      // Attach unit numbers
      const unitIds = [...new Set(levies.map((l) => l.unitId))];
      const units = await ctx.db.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true },
      });
      const unitMap = Object.fromEntries(units.map((u) => [u.id, u.unitNumber]));

      return levies.map((l) => ({
        ...l,
        unitNumber: unitMap[l.unitId] ?? l.unitId,
      }));
    }),

  createLevy: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        unitId: z.string(),
        levyType: levyTypeEnum,
        amountCents: z.number().int().positive(),
        quarterStart: z.string(),
        dueDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const unitForBuilding = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });

      if (unitForBuilding.buildingId !== input.buildingId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected unit does not belong to this building.",
        });
      }

      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Set up strata info for this building first.",
        });
      }

      const levy = await ctx.db.strataLevy.create({
        data: {
          strataInfoId: strataInfo.id,
          unitId: input.unitId,
          levyType: input.levyType,
          amountCents: input.amountCents,
          quarterStart: new Date(input.quarterStart),
          dueDate: new Date(input.dueDate),
        },
      });

      // Notify + email the unit owner (fire-and-forget)
      const unitWithOwners = await ctx.db.unit.findUnique({
        where: { id: input.unitId },
        include: {
          building: { select: { name: true } },
          ownerships: {
            where: { isActive: true },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
        },
      });
      if (unitWithOwners) {
        for (const ownership of unitWithOwners.ownerships) {
          const { user } = ownership;
          await createNotification(ctx.db, {
            userId: user.id,
            type: "LEVY_CREATED",
            title: `New levy raised: ${input.levyType.replace(/_/g, " ")}`,
            body: `Unit ${unitWithOwners.unitNumber} — due ${new Date(input.dueDate).toLocaleDateString("en-AU")}`,
            linkUrl: "/resident/levies",
          });
          void sendLevyNoticeEmail(user.email, {
            recipientName: `${user.firstName} ${user.lastName}`,
            buildingName: unitWithOwners.building.name,
            unitNumber: unitWithOwners.unitNumber,
            levyType: input.levyType,
            amountCents: input.amountCents,
            dueDate: new Date(input.dueDate),
          });
        }
      }

      return levy;
    }),

  bulkCreateLevies: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        levyType: levyTypeEnum,
        amountCents: z.number().int().positive(),
        quarterStart: z.string(),
        dueDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Set up strata info for this building first.",
        });
      }

      const units = await ctx.db.unit.findMany({
        where: { buildingId: input.buildingId },
        select: { id: true },
      });

      if (units.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No units found for this building.",
        });
      }

      const result = await ctx.db.strataLevy.createMany({
        data: units.map((u) => ({
          strataInfoId: strataInfo.id,
          unitId: u.id,
          levyType: input.levyType,
          amountCents: input.amountCents,
          quarterStart: new Date(input.quarterStart),
          dueDate: new Date(input.dueDate),
        })),
      });

      // Notify + email all active unit owners (fire-and-forget)
      const unitsWithOwners = await ctx.db.unit.findMany({
        where: { buildingId: input.buildingId },
        include: {
          building: { select: { name: true } },
          ownerships: {
            where: { isActive: true },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          },
        },
      });
      const notifications = unitsWithOwners.flatMap((unit) =>
        unit.ownerships.map((o) => ({
          userId: o.user.id,
          type: "LEVY_CREATED" as const,
          title: `New levy raised: ${input.levyType.replace(/_/g, " ")}`,
          body: `Unit ${unit.unitNumber} — due ${new Date(input.dueDate).toLocaleDateString("en-AU")}`,
          linkUrl: "/resident/levies",
        }))
      );
      if (notifications.length > 0) {
        await Promise.all(notifications.map((n) => createNotification(ctx.db, n)));
      }
      for (const unit of unitsWithOwners) {
        for (const ownership of unit.ownerships) {
          void sendLevyNoticeEmail(ownership.user.email, {
            recipientName: `${ownership.user.firstName} ${ownership.user.lastName}`,
            buildingName: unit.building.name,
            unitNumber: unit.unitNumber,
            levyType: input.levyType,
            amountCents: input.amountCents,
            dueDate: new Date(input.dueDate),
          });
        }
      }

      return { count: result.count };
    }),

  updateLevyStatus: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        status: paymentStatusEnum,
        paidDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const levy = await ctx.db.strataLevy.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          strataInfo: { select: { buildingId: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, levy.strataInfo.buildingId);

      return ctx.db.strataLevy.update({
        where: { id: input.id },
        data: {
          status: input.status,
          paidDate:
            input.status === "PAID"
              ? input.paidDate
                ? new Date(input.paidDate)
                : new Date()
              : null,
        },
      });
    }),

  deleteLevy: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const levy = await ctx.db.strataLevy.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          strataInfo: { select: { buildingId: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, levy.strataInfo.buildingId);

      return ctx.db.strataLevy.delete({ where: { id: input.id } });
    }),

  // ── Bylaws ────────────────────────────────────────────────────────────────

  createBylaw: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        bylawNumber: z.number().int().positive(),
        title: z.string().min(1),
        content: z.string().min(1),
        effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const strataInfo = await ctx.db.strataInfo.findUnique({
        where: { buildingId: input.buildingId },
      });
      if (!strataInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Set up strata info for this building first.",
        });
      }

      return ctx.db.strataBylaw.create({
        data: {
          strataInfoId: strataInfo.id,
          bylawNumber: input.bylawNumber,
          title: input.title,
          content: input.content,
          effectiveDate: new Date(input.effectiveDate),
        },
      });
    }),

  updateBylaw: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        bylawNumber: z.number().int().positive().optional(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bylaw = await ctx.db.strataBylaw.findUniqueOrThrow({
        where: { id: input.id },
        select: { strataInfo: { select: { buildingId: true } } },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, bylaw.strataInfo.buildingId);

      const { id, effectiveDate, ...rest } = input;
      return ctx.db.strataBylaw.update({
        where: { id },
        data: {
          ...rest,
          ...(effectiveDate ? { effectiveDate: new Date(effectiveDate) } : {}),
        },
      });
    }),

  deleteBylaw: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bylaw = await ctx.db.strataBylaw.findUniqueOrThrow({
        where: { id: input.id },
        select: { strataInfo: { select: { buildingId: true } } },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, bylaw.strataInfo.buildingId);

      return ctx.db.strataBylaw.delete({ where: { id: input.id } });
    }),

  createCheckoutSession: ownerProcedure
    .input(z.object({ levyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Load levy and resolve its building via strataInfo
      const levy = await ctx.db.strataLevy.findUnique({
        where: { id: input.levyId },
        include: {
          strataInfo: {
            include: {
              building: { select: { name: true } },
            },
          },
        },
      });

      if (!levy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Levy not found." });
      }

      // 2. Verify caller owns the unit (admins bypass this check)
      const callerMemberships = await ctx.db.organisationMembership.findMany({
        where: { userId: ctx.user!.id, isActive: true },
        select: { role: true },
      });
      const callerAssignments = await ctx.db.buildingAssignment.findMany({
        where: { userId: ctx.user!.id, isActive: true },
        select: { role: true },
      });
      const allRoles = [
        ...callerMemberships.map((m) => m.role),
        ...callerAssignments.map((a) => a.role),
      ];
      const isAdmin = allRoles.some(
        (r) => r === "SUPER_ADMIN" || r === "BUILDING_MANAGER"
      );

      if (!isAdmin) {
        const ownership = await ctx.db.ownership.findFirst({
          where: {
            userId: ctx.user!.id,
            unitId: levy.unitId,
            isActive: true,
          },
        });
        if (!ownership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not own this unit.",
          });
        }
      }

      // 3. Only PENDING or OVERDUE levies can be paid
      if (levy.status !== "PENDING" && levy.status !== "OVERDUE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only PENDING or OVERDUE levies can be paid.",
        });
      }

      // 4. Resolve unit number for the line item name
      const unit = await ctx.db.unit.findUnique({
        where: { id: levy.unitId },
        select: { unitNumber: true },
      });

      const levyLabels: Record<string, string> = {
        ADMIN_FUND: "Admin Fund",
        CAPITAL_WORKS: "Capital Works",
        SPECIAL_LEVY: "Special Levy",
      };
      const levyLabel = levyLabels[levy.levyType] ?? levy.levyType;
      const buildingName = levy.strataInfo.building.name;
      const unitNumber = unit?.unitNumber ?? levy.unitId;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      // 5. Reuse existing open session if one exists (prevents double-click creating duplicate sessions)
      if (levy.stripeSessionId) {
        const existing = await getStripe().checkout.sessions.retrieve(levy.stripeSessionId);
        if (existing.status === "open") {
          return { url: existing.url! };
        }
      }

      // 6. Create Stripe Checkout Session
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              unit_amount: levy.amountCents,
              product_data: {
                name: `${levyLabel} — Unit ${unitNumber}, ${buildingName}`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          levyId: levy.id,
          userId: ctx.user!.id,
        },
        success_url: `${appUrl}/resident/levies?payment=success`,
        cancel_url: `${appUrl}/resident/levies?payment=cancelled`,
      });

      // 7. Save session ID to levy for webhook lookup
      await ctx.db.strataLevy.update({
        where: { id: levy.id },
        data: { stripeSessionId: session.id },
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a checkout URL.",
        });
      }
      return { url: session.url };
    }),
});
