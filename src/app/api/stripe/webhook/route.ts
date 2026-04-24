import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/server/db/client";
import { sendPaymentReceiptEmail } from "@/lib/email/send";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

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

    if (!levy) {
      // Unknown session — return 200 so Stripe doesn't retry
      return NextResponse.json({ received: true });
    }

    // Idempotency guard: skip if already PAID
    if (levy.status === "PAID") {
      return NextResponse.json({ received: true });
    }

    const paidDate = new Date();

    await db.strataLevy.update({
      where: { id: levy.id },
      data: { status: "PAID", paidDate },
    });

    // Send receipt email to the levy owner
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

  // Return 200 for all verified events (including unhandled ones)
  return NextResponse.json({ received: true });
}
