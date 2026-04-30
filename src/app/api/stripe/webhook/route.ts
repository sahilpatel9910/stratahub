import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { db } from "@/server/db/client";
import { sendPaymentReceiptEmail, sendCustomBillReceiptEmail, sendRentReceiptEmail } from "@/lib/email/send";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ── Levy payment ─────────────────────────────────────────
    const levy = await db.strataLevy.findFirst({
      where: { stripeSessionId: session.id },
      include: {
        strataInfo: {
          include: {
            building: { select: { name: true } },
          },
        },
      },
    });

    if (levy) {
      if (levy.status !== "PAID") {
        const paidDate = new Date();
        await db.strataLevy.update({
          where: { id: levy.id },
          data: { status: "PAID", paidDate },
        });

        const unit = await db.unit.findUnique({
          where: { id: levy.unitId },
          select: {
            unitNumber: true,
            ownerships: {
              where: { isActive: true },
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });

        if (unit) {
          for (const ownership of unit.ownerships) {
            const { user } = ownership;
            void sendPaymentReceiptEmail(user.email, {
              recipientName: `${user.firstName} ${user.lastName}`,
              buildingName: levy.strataInfo.building.name,
              unitNumber: unit.unitNumber,
              levyType: levy.levyType,
              amountCents: levy.amountCents,
              paidDate,
              stripeSessionId: session.id,
            });
          }
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Custom bill payment ───────────────────────────────────
    const bill = await db.customBill.findFirst({
      where: { stripeSessionId: session.id },
      include: {
        building: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        recipient: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (bill) {
      if (bill.status !== "PAID") {
        const paidDate = new Date();
        await db.customBill.update({
          where: { id: bill.id },
          data: { status: "PAID", paidDate },
        });

        void sendCustomBillReceiptEmail(bill.recipient.email, {
          recipientName: `${bill.recipient.firstName} ${bill.recipient.lastName}`,
          buildingName: bill.building.name,
          unitNumber: bill.unit.unitNumber,
          title: bill.title,
          category: bill.category,
          amountCents: bill.amountCents,
          paidDate,
          stripeSessionId: session.id,
        });
      }
      return NextResponse.json({ received: true });
    }

    // ── Rent payment ──────────────────────────────────────────
    const rentPayment = await db.rentPayment.findFirst({
      where: { stripeSessionId: session.id },
      include: {
        tenancy: {
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
            unit: {
              select: {
                unitNumber: true,
                building: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (rentPayment && rentPayment.status !== "PAID") {
      const paidDate = new Date();
      await db.rentPayment.update({
        where: { id: rentPayment.id },
        data: { status: "PAID", paidDate, paymentMethod: "stripe" },
      });

      const { user, unit } = rentPayment.tenancy;
      void sendRentReceiptEmail(user.email, {
        recipientName: `${user.firstName} ${user.lastName}`,
        buildingName: unit.building.name,
        unitNumber: unit.unitNumber,
        amountCents: rentPayment.amountCents,
        dueDate: rentPayment.dueDate,
        paidDate,
        stripeSessionId: session.id,
      });
    }
  }

  // Return 200 for all verified events (including unhandled ones)
  return NextResponse.json({ received: true });
}
