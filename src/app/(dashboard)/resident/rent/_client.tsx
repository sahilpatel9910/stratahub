"use client";

import { skipToken } from "@tanstack/react-query";
import { CalendarDays, DollarSign, AlertTriangle, Wallet, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    PARTIAL: "bg-blue-100 text-blue-800",
    WAIVED: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    PAID: "Paid",
    OVERDUE: "Overdue",
    PENDING: "Pending",
    PARTIAL: "Partial",
    WAIVED: "Waived",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function ResidentRentClient() {
  const { data: tenancy, isLoading: tenancyLoading } =
    trpc.resident.getMyTenancy.useQuery();

  const { data: payments = [], isLoading: paymentsLoading } =
    trpc.rent.listByTenancy.useQuery(
      tenancy ? { tenancyId: tenancy.id } : skipToken
    );

  const isLoading = tenancyLoading || (!!tenancy && paymentsLoading);

  const overdueCount = payments.filter((p) => p.status === "OVERDUE").length;
  const totalPaidCents = payments
    .filter((p) => p.status === "PAID" || p.status === "PARTIAL")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const nextDue = payments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  if (!tenancyLoading && !tenancy) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="app-panel overflow-hidden p-6 md:p-8">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              My Rent
            </h1>
          </div>
        </section>
        <section className="app-panel px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/55 text-accent-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-foreground">
            No active tenancy
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Rent tracking is available for tenants. If you are renting a unit,
            contact your building manager to activate your tenancy.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Hero panel */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            {tenancyLoading ? (
              <>
                <Skeleton className="mt-3 h-10 w-64 rounded-xl" />
                <Skeleton className="mt-4 h-5 w-48 rounded-full" />
              </>
            ) : (
              <>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
                  My Rent
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  Unit {tenancy!.unit.unitNumber} &mdash;{" "}
                  {tenancy!.unit.building.name}
                  {tenancy!.unit.building.suburb
                    ? `, ${tenancy!.unit.building.suburb}`
                    : ""}
                </p>
              </>
            )}
          </div>

          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Lease details</p>
            {tenancyLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <LeaseSignal
                  icon={DollarSign}
                  label="Rent"
                  value={`${formatCurrency(tenancy!.rentAmountCents)} / ${FREQUENCY_LABELS[tenancy!.rentFrequency] ?? tenancy!.rentFrequency}`}
                />
                <LeaseSignal
                  icon={CalendarDays}
                  label="Lease start"
                  value={formatDate(tenancy!.leaseStartDate)}
                />
                <LeaseSignal
                  icon={CalendarDays}
                  label="Lease end"
                  value={formatDate(tenancy!.leaseEndDate)}
                />
                <LeaseSignal
                  icon={Building2}
                  label="Bond"
                  value={formatCurrency(tenancy!.bondAmountCents)}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next Payment Due
            </CardTitle>
            <div className="rounded-lg bg-yellow-50 p-2">
              <CalendarDays className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold">
                {nextDue ? formatDate(nextDue.dueDate) : "All paid"}
              </p>
            )}
            {nextDue && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(nextDue.amountCents)} due
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Payments
            </CardTitle>
            <div className="rounded-lg bg-red-50 p-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>
                {overdueCount}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {overdueCount === 1 ? "payment overdue" : "payments overdue"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(totalPaidCents)}</p>
            )}
            <p className="text-xs text-muted-foreground">
              across {payments.filter((p) => p.status === "PAID" || p.status === "PARTIAL").length} payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment schedule */}
      <section className="app-panel overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="panel-kicker">Payment Schedule</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
            Rent history &amp; upcoming payments
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid Date</TableHead>
              <TableHead>Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground"
                >
                  No payment schedule has been set up yet.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {formatDate(payment.dueDate)}
                  </TableCell>
                  <TableCell>{formatCurrency(payment.amountCents)}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.paidDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.paymentMethod ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function LeaseSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
