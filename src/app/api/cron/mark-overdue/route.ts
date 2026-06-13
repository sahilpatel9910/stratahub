import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";

/**
 * GET /api/cron/mark-overdue
 *
 * Marks all PENDING rent payments, strata levies, and custom bills as OVERDUE
 * when their dueDate has passed. Designed to be called by an external scheduler
 * (e.g. Vercel Cron, GitHub Actions) once per day.
 *
 * Protected by a shared CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const [rent, levies, bills] = await Promise.all([
    db.rentPayment.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now },
        tenancy: { isActive: true },
      },
      data: { status: "OVERDUE" },
    }),
    db.strataLevy.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    }),
    db.customBill.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    marked: {
      rentPayments: rent.count,
      strataLevies: levies.count,
      customBills: bills.count,
    },
  });
}
