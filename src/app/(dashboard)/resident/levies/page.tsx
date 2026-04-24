"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export default function ResidentLeviesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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

  const checkoutMutation = trpc.strata.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to start payment. Please try again.");
    },
  });

  const { data: levies = [], isLoading } = trpc.resident.getMyLevies.useQuery(
    statusFilter !== "ALL" ? { status: statusFilter as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED" } : {}
  );

  const unpaidTotal = levies
    .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.amountCents, 0);
  const paidCount = levies.filter((l) => l.status === "PAID").length;
  const overdueCount = levies.filter((l) => l.status === "OVERDUE").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
    </div>
  );
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
