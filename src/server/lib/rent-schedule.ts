export type RentFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export type RentScheduleEntry = {
  tenancyId: string;
  amountCents: number;
  dueDate: Date;
  status: "PENDING";
};

/**
 * Single source of truth for generating a tenancy's rent payment schedule.
 * Used by rent.generateSchedule, rent.completeTenancySetup, tenancy.create
 * and units.assignResident — do NOT re-implement this per router.
 *
 * A year has 52 weeks / 26 fortnights / 12 months — NOT 4 weeks or 2
 * fortnights per month (that undercounts a 12-month schedule by ~8%).
 * The loop breaks at leaseEndDate, so `months` is the horizon when no
 * end date is set.
 */
export function buildRentScheduleEntries({
  tenancyId,
  leaseStartDate,
  rentFrequency,
  rentAmountCents,
  months,
  leaseEndDate,
}: {
  tenancyId: string;
  leaseStartDate: Date;
  rentFrequency: RentFrequency;
  rentAmountCents: number;
  months: number;
  leaseEndDate?: Date | null;
}): RentScheduleEntry[] {
  const payments: RentScheduleEntry[] = [];
  const startDate = new Date(leaseStartDate);
  const count =
    rentFrequency === "WEEKLY" ? Math.round((months * 52) / 12) :
    rentFrequency === "FORTNIGHTLY" ? Math.round((months * 26) / 12) :
    months;

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startDate);
    if (rentFrequency === "WEEKLY") {
      dueDate.setDate(dueDate.getDate() + i * 7);
    } else if (rentFrequency === "FORTNIGHTLY") {
      dueDate.setDate(dueDate.getDate() + i * 14);
    } else {
      dueDate.setMonth(dueDate.getMonth() + i);
    }

    if (leaseEndDate && dueDate >= leaseEndDate) break;

    payments.push({
      tenancyId,
      amountCents: rentAmountCents,
      dueDate,
      status: "PENDING",
    });
  }

  return payments;
}
