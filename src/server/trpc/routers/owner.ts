import { createTRPCRouter, tenantOrAboveProcedure } from "@/server/trpc/trpc";

type Transaction = {
  date: Date;
  type: "LEVY" | "CUSTOM_BILL" | "RENT_INCOME";
  description: string;
  amountCents: number;
  status: string;
};

export const ownerRouter = createTRPCRouter({
  getFinancialSummary: tenantOrAboveProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    // Find all units the user owns
    const ownerships = await ctx.db.ownership.findMany({
      where: { userId, isActive: true },
      select: {
        unitId: true,
        unit: {
          select: {
            unitNumber: true,
            buildingId: true,
            building: { select: { name: true } },
          },
        },
      },
    });

    if (ownerships.length === 0) {
      return {
        hasOwnerships: false,
        levyTotalPaidCents: 0,
        levyOutstandingCents: 0,
        customBillsOwingCents: 0,
        rentIncomeTotalCents: 0,
        transactions: [] as Transaction[],
      };
    }

    const unitIds = ownerships.map((o) => o.unitId);

    // 1. Strata levies for owned units
    const levies = await ctx.db.strataLevy.findMany({
      where: { unitId: { in: unitIds } },
      orderBy: { dueDate: "desc" },
    });

    // 2. Custom bills addressed to this user (as recipient)
    const customBills = await ctx.db.customBill.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
    });

    // 3. Rent payments received (tenancies on owned units)
    const tenancies = await ctx.db.tenancy.findMany({
      where: { unitId: { in: unitIds }, isActive: true },
      include: {
        rentPayments: {
          where: { status: { in: ["PAID", "PARTIAL"] } },
          orderBy: { paidDate: "desc" },
        },
        unit: { select: { unitNumber: true } },
      },
    });

    // Aggregate stats
    const levyTotalPaidCents = levies
      .filter((l) => l.status === "PAID")
      .reduce((sum, l) => sum + l.amountCents, 0);
    const levyOutstandingCents = levies
      .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
      .reduce((sum, l) => sum + l.amountCents, 0);
    const customBillsOwingCents = customBills
      .filter((b) => b.status === "PENDING" || b.status === "OVERDUE")
      .reduce((sum, b) => sum + b.amountCents, 0);
    const rentIncomeTotalCents = tenancies
      .flatMap((t) => t.rentPayments)
      .reduce((sum, p) => sum + p.amountCents, 0);

    const transactions: Transaction[] = [
      ...levies.map((l) => ({
        date: l.paidDate ?? l.dueDate,
        type: "LEVY" as const,
        description: l.levyType.replace(/_/g, " "),
        amountCents: l.amountCents,
        status: l.status,
      })),
      ...customBills.map((b) => ({
        date: b.createdAt,
        type: "CUSTOM_BILL" as const,
        description: b.description ?? b.title,
        amountCents: b.amountCents,
        status: b.status,
      })),
      ...tenancies.flatMap((t) =>
        t.rentPayments.map((p) => ({
          date: p.paidDate ?? p.dueDate,
          type: "RENT_INCOME" as const,
          description: `Rent — Unit ${t.unit.unitNumber}`,
          amountCents: p.amountCents,
          status: p.status,
        }))
      ),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      hasOwnerships: true,
      levyTotalPaidCents,
      levyOutstandingCents,
      customBillsOwingCents,
      rentIncomeTotalCents,
      transactions,
    };
  }),
});
