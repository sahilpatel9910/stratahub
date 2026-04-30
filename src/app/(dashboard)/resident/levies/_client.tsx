"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  formatCurrency,
  CUSTOM_BILL_CATEGORY_LABELS,
  CUSTOM_BILL_CATEGORY_COLORS,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Receipt, Wallet, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
  PARTIAL: "Partial",
  WAIVED: "Waived",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  WAIVED: "bg-gray-100 text-gray-800",
};

const LEVY_TYPE_LABELS: Record<string, string> = {
  ADMIN_FUND: "Admin Fund",
  CAPITAL_WORKS: "Capital Works",
  SPECIAL_LEVY: "Special Levy",
};

export default function ResidentLeviesClient() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const checkoutMutation = trpc.strata.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to start payment. Please try again.");
    },
  });

  const customBillCheckoutMutation = trpc.customBills.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to start payment. Please try again.");
    },
  });

  const { data: customBills = [], isLoading: billsLoading } =
    trpc.customBills.getMyBills.useQuery({});

  const { data: levies = [], isLoading } = trpc.resident.getMyLevies.useQuery(
    statusFilter !== "ALL" ? { status: statusFilter as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED" } : {}
  );

  const { data: financials, isLoading: financialsLoading } = trpc.owner.getFinancialSummary.useQuery();

  const levyUnpaidTotal = levies
    .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.amountCents, 0);
  const billUnpaidTotal = customBills
    .filter((b) => b.status === "PENDING" || b.status === "OVERDUE")
    .reduce((sum, b) => sum + b.amountCents, 0);
  const unpaidTotal = levyUnpaidTotal + billUnpaidTotal;
  const paidCount = levies.filter((l) => l.status === "PAID").length;
  const overdueCount = levies.filter((l) => l.status === "OVERDUE").length;

  function exportCSV() {
    if (!financials) return;
    const rows = [
      ["Date", "Type", "Description", "Amount (AUD)", "Status"],
      ...financials.transactions.map((t) => [
        new Date(t.date).toLocaleDateString("en-AU"),
        t.type === "LEVY" ? "Levy" : t.type === "CUSTOM_BILL" ? "Custom Bill" : "Rent Income",
        t.description,
        (t.amountCents / 100).toFixed(2),
        t.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-summary-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Suspense fallback={null}>
        <PaymentToastHandler />
      </Suspense>
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Levy history and balances
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Track your strata charges, see what is overdue, and keep a clear record of paid quarters.
            </p>
          </div>
          <div className="rounded-3xl border border-orange-200/70 bg-orange-50/90 px-5 py-4 text-left shadow-sm lg:min-w-60 lg:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700/80">Outstanding</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-orange-800">
              {formatCurrency(unpaidTotal)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <ResidentMetricCard
          icon={Wallet}
          label="Outstanding balance"
          value={unpaidTotal > 0 ? formatCurrency(unpaidTotal) : "All paid"}
          tone={unpaidTotal > 0 ? "warning" : "positive"}
        />
        <ResidentMetricCard
          icon={CreditCard}
          label="Paid levies"
          value={`${paidCount}`}
          tone="default"
        />
        <ResidentMetricCard
          icon={Receipt}
          label="Overdue items"
          value={`${overdueCount}`}
          tone={overdueCount > 0 ? "warning" : "muted"}
        />
      </div>

      <Tabs defaultValue="levies">
        <TabsList>
          <TabsTrigger value="levies">Levies</TabsTrigger>
          <TabsTrigger value="custom-bills">Custom Bills</TabsTrigger>
          <TabsTrigger value="financials">Financial Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="levies" className="mt-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Levy entries</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Strata levy history for your unit
              </p>
            </div>
          </div>

          <div className="w-44">
            <Select
              value={statusFilter}
              onValueChange={(v) => v !== null && setStatusFilter(v)}
            >
              <SelectTrigger className="w-full rounded-xl bg-background">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="WAIVED">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 px-6 py-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : levies.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No levies found for the selected filter.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3">Unit</TableHead>
                    <TableHead className="px-4 py-3">Type</TableHead>
                    <TableHead className="px-4 py-3">Quarter</TableHead>
                    <TableHead className="px-4 py-3">Due Date</TableHead>
                    <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levies.map((levy) => (
                    <TableRow key={levy.id}>
                      <TableCell className="px-4 py-3 font-medium">{levy.unitNumber}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {LEVY_TYPE_LABELS[levy.levyType] ?? levy.levyType}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {new Date(levy.quarterStart).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {new Date(levy.dueDate).toLocaleDateString("en-AU")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-medium">
                        {formatCurrency(levy.amountCents)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={STATUS_COLORS[levy.status] ?? ""}>
                          {STATUS_LABELS[levy.status] ?? levy.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {(levy.status === "PENDING" || levy.status === "OVERDUE") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg text-xs font-medium"
                            disabled={checkoutMutation.isPending}
                            onClick={() => checkoutMutation.mutate({ levyId: levy.id })}
                          >
                            {checkoutMutation.isPending && checkoutMutation.variables?.levyId === levy.id ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : null}
                            Pay Now
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-bills" className="mt-6 flex flex-col gap-6">
          {/* Custom Bills */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Custom bills</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Individual charges raised by building management
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {billsLoading ? (
                <div className="space-y-3 px-6 py-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : customBills.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No custom bills on your account.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 py-3">Bill</TableHead>
                      <TableHead className="px-4 py-3">Category</TableHead>
                      <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                      <TableHead className="px-4 py-3">Due Date</TableHead>
                      <TableHead className="px-4 py-3">Status</TableHead>
                      <TableHead className="px-4 py-3">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="px-4 py-3">
                          <div className="font-medium">{bill.title}</div>
                          {bill.description && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {bill.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={CUSTOM_BILL_CATEGORY_COLORS[bill.category] ?? ""}>
                            {CUSTOM_BILL_CATEGORY_LABELS[bill.category] ?? bill.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-medium">
                          {formatCurrency(bill.amountCents)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {new Date(bill.dueDate).toLocaleDateString("en-AU", { timeZone: "UTC" })}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge className={STATUS_COLORS[bill.status] ?? ""}>
                            {STATUS_LABELS[bill.status] ?? bill.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {(bill.status === "PENDING" || bill.status === "OVERDUE") &&
                            bill.paymentMode === "ONLINE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-xs font-medium"
                                disabled={customBillCheckoutMutation.isPending}
                                onClick={() =>
                                  customBillCheckoutMutation.mutate({ billId: bill.id })
                                }
                              >
                                {customBillCheckoutMutation.isPending &&
                                customBillCheckoutMutation.variables?.billId === bill.id ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                ) : null}
                                Pay Now
                              </Button>
                            )}
                          {(bill.status === "PENDING" || bill.status === "OVERDUE") &&
                            bill.paymentMode === "MANUAL" && (
                              <span className="text-xs text-muted-foreground">Pay at reception</span>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="mt-6">
          {/* Stat cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Levies Paid", value: financials?.levyTotalPaidCents ?? 0, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Levies Outstanding", value: financials?.levyOutstandingCents ?? 0, color: "text-red-600", bg: "bg-red-50" },
              { label: "Custom Bills Owing", value: financials?.customBillsOwingCents ?? 0, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Rent Income", value: financials?.rentIncomeTotalCents ?? 0, color: "text-sky-600", bg: "bg-sky-50" },
            ].map(({ label, value, color, bg }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  {financialsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Transaction table */}
          <div className="app-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="panel-kicker">Transaction History</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
                  All financial activity
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                disabled={!financials || financials.transactions.length === 0}
                onClick={exportCSV}
              >
                Export CSV
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !financials || financials.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  financials.transactions.map((t, i) => {
                    const typeLabel =
                      t.type === "LEVY" ? "Levy"
                      : t.type === "CUSTOM_BILL" ? "Custom Bill"
                      : "Rent Income";
                    const typeBadgeClass =
                      t.type === "LEVY" ? "bg-violet-100 text-violet-800"
                      : t.type === "CUSTOM_BILL" ? "bg-amber-100 text-amber-800"
                      : "bg-sky-100 text-sky-800";
                    const statusClass: Record<string, string> = {
                      PAID: "bg-green-100 text-green-800",
                      PENDING: "bg-yellow-100 text-yellow-800",
                      OVERDUE: "bg-red-100 text-red-800",
                      PARTIAL: "bg-blue-100 text-blue-800",
                      WAIVED: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">
                          {new Date(t.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}>
                            {typeLabel}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell>{formatCurrency(t.amountCents)}</TableCell>
                        <TableCell>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentToastHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (toastShownRef.current) return;
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toastShownRef.current = true;
      toast.success("Payment successful! Your levy has been marked as paid.");
      router.replace("/resident/levies");
    } else if (payment === "cancelled") {
      toastShownRef.current = true;
      toast.info("Payment cancelled.");
      router.replace("/resident/levies");
    }
  }, [searchParams, router]);

  return null;
}

function ResidentMetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "default" | "warning" | "positive" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-accent/55 text-accent-foreground",
    warning: "bg-orange-100 text-orange-700",
    positive: "bg-emerald-100 text-emerald-700",
    muted: "bg-secondary text-secondary-foreground",
  };

  return (
    <section className="app-grid-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}
