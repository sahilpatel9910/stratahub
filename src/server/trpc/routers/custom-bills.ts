import { z } from "zod";
import {
  buildingManagerProcedure,
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
  tenantOrAboveProcedure,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingManagementAccess,
  assertBuildingOperationsAccess,
} from "@/server/auth/building-access";
import { createNotification } from "@/server/trpc/lib/create-notification";
import { sendCustomBillEmail } from "@/lib/email/send";
import { getStripe } from "@/lib/stripe/client";

const categoryEnum = z.enum([
  "WATER_USAGE",
  "PARKING_FINE",
  "DAMAGE",
  "CLEANING",
  "MAINTENANCE_CHARGEBACK",
  "MOVE_IN_FEE",
  "MOVE_OUT_FEE",
  "KEY_REPLACEMENT",
  "DOCUMENT_FEE",
  "ADMIN_FEE",
  "OTHER",
]);

const paymentStatusEnum = z.enum([
  "PENDING",
  "PAID",
  "OVERDUE",
  "PARTIAL",
  "WAIVED",
]);

export const customBillsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: paymentStatusEnum.optional(),
        category: categoryEnum.optional(),
        unitId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      const bills = await ctx.db.customBill.findMany({
        where: {
          buildingId: input.buildingId,
          ...(input.status ? { status: input.status } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.unitId ? { unitId: input.unitId } : {}),
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        include: {
          unit: { select: { unitNumber: true } },
          recipient: { select: { firstName: true, lastName: true } },
        },
      });

      return bills.map((b) => ({
        ...b,
        unitNumber: b.unit.unitNumber,
        recipientName: `${b.recipient.firstName} ${b.recipient.lastName}`,
      }));
    }),

  create: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        unitId: z.string(),
        recipientType: z.enum(["OWNER", "TENANT"]),
        recipientId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: categoryEnum,
        amountCents: z.number().int().positive(),
        dueDate: z.string(),
        paymentMode: z.enum(["ONLINE", "MANUAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        include: { building: { select: { name: true } } },
      });
      if (unit.buildingId !== input.buildingId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unit does not belong to this building.",
        });
      }

      if (input.recipientType === "OWNER") {
        const ownership = await ctx.db.ownership.findFirst({
          where: { userId: input.recipientId, unitId: input.unitId, isActive: true },
        });
        if (!ownership) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Recipient is not an active owner of this unit.",
          });
        }
      } else {
        const tenancy = await ctx.db.tenancy.findFirst({
          where: { userId: input.recipientId, unitId: input.unitId, isActive: true },
        });
        if (!tenancy) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Recipient is not an active tenant of this unit.",
          });
        }
      }

      const bill = await ctx.db.customBill.create({
        data: {
          buildingId: input.buildingId,
          unitId: input.unitId,
          recipientType: input.recipientType,
          recipientId: input.recipientId,
          title: input.title,
          description: input.description,
          category: input.category,
          amountCents: input.amountCents,
          dueDate: new Date(input.dueDate),
          paymentMode: input.paymentMode,
          createdById: ctx.user!.id,
        },
      });

      const recipient = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.recipientId },
        select: { email: true, firstName: true, lastName: true },
      });

      await createNotification(ctx.db, {
        userId: input.recipientId,
        type: "CUSTOM_BILL_CREATED",
        title: `New bill: ${input.title}`,
        body: `Unit ${unit.unitNumber} — due ${new Date(input.dueDate).toLocaleDateString("en-AU")}`,
        linkUrl: "/resident/levies",
      });

      void sendCustomBillEmail(recipient.email, {
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        buildingName: unit.building.name,
        unitNumber: unit.unitNumber,
        title: input.title,
        category: input.category,
        amountCents: input.amountCents,
        dueDate: new Date(input.dueDate),
        paymentMode: input.paymentMode,
      });

      return bill;
    }),

  updateStatus: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: paymentStatusEnum,
        paidDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.customBill.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, bill.buildingId);

      return ctx.db.customBill.update({
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

  delete: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.customBill.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, bill.buildingId);

      return ctx.db.customBill.delete({ where: { id: input.id } });
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ billId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.customBill.findUnique({
        where: { id: input.billId },
        include: {
          unit: { select: { unitNumber: true } },
          building: { select: { name: true } },
        },
      });

      if (!bill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found." });
      }
      if (bill.recipientId !== ctx.user!.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This bill is not addressed to you.",
        });
      }
      if (bill.paymentMode !== "ONLINE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This bill requires manual payment. Contact your building manager.",
        });
      }
      if (bill.status !== "PENDING" && bill.status !== "OVERDUE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only PENDING or OVERDUE bills can be paid online.",
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              unit_amount: bill.amountCents,
              product_data: {
                name: `${bill.title} — Unit ${bill.unit.unitNumber}, ${bill.building.name}`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          billId: bill.id,
          userId: ctx.user!.id,
        },
        success_url: `${appUrl}/resident/levies?payment=success`,
        cancel_url: `${appUrl}/resident/levies?payment=cancelled`,
      });

      await ctx.db.customBill.update({
        where: { id: bill.id },
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

  getMyBills: tenantOrAboveProcedure
    .input(z.object({ status: paymentStatusEnum.optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.customBill.findMany({
        where: {
          recipientId: ctx.user!.id,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { dueDate: "desc" },
        include: {
          unit: { select: { unitNumber: true } },
        },
      });
    }),
});
