"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", PAID: "Paid", OVERDUE: "Overdue",
  PARTIAL: "Partial", WAIVED: "Waived",
};
const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  WAIVED: "bg-gray-100 text-gray-600",
};
const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly", FORTNIGHTLY: "Fortnightly", MONTHLY: "Monthly",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function TenancyDetailClient({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const { data: tenancy, isLoading, isError } = trpc.tenancy.getById.useQuery({ id });

  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amountCents: "", paidDate: "", paymentMethod: "",
  });

  const recordPaymentMutation = trpc.rent.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      void utils.tenancy.getById.invalidate({ id });
      setRecordOpen(false);
      setSelectedPaymentId(null);
      setPaymentForm({ amountCents: "", paidDate: "", paymentMethod: "" });
    },
    onError: (e) => toast.error(e.message ?? "Failed to record payment"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="mt-4 h-5 w-48 rounded-full" />
        </section>
      </div>
    );
  }

  if (isError || !tenancy) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <p className="text-sm text-muted-foreground">Could not load tenancy.</p>
          <Link href="/manager/rent" className="mt-3 inline-flex text-sm text-muted-foreground hover:text-foreground">
            ← Back to Rent
          </Link>
        </section>
      </div>
    );
  }

  const overdueCount = tenancy.rentPayments.filter((p) => p.status === "OVERDUE").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <Link
          href="/manager/rent"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rent
        </Link>
        <p className="eyebrow-label text-primary/80">Tenancy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
          {tenancy.user.firstName} {tenancy.user.lastName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unit {tenancy.unit.unitNumber} — {tenancy.unit.building.name}
          {tenancy.unit.building.suburb ? `, ${tenancy.unit.building.suburb}` : ""}
        </p>
      </section>

      {/* Lease details */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <p className="eyebrow-label">Lease details</p>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {[
            ["Tenant", `${tenancy.user.firstName} ${tenancy.user.lastName}`],
            ["Email", tenancy.user.email],
            ["Rent", `${formatCurrency(tenancy.rentAmountCents)} / ${FREQ_LABELS[tenancy.rentFrequency]}`],
            ["Bond", formatCurrency(tenancy.bondAmountCents)],
            ["Lease start", formatDate(tenancy.leaseStartDate)],
            ["Lease end", formatDate(tenancy.leaseEndDate)],
            ["Move in", formatDate(tenancy.moveInDate)],
            ["Overdue", overdueCount > 0 ? `${overdueCount} payment(s)` : "None"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className={`text-sm font-medium ${label === "Overdue" && overdueCount > 0 ? "text-red-600" : "text-foreground"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenancy.rentPayments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{formatDate(p.dueDate)}</TableCell>
                <TableCell>{formatCurrency(p.amountCents)}</TableCell>
                <TableCell>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(p.paidDate)}</TableCell>
                <TableCell className="text-muted-foreground">{p.paymentMethod ?? "—"}</TableCell>
                <TableCell>
                  {(p.status === "PENDING" || p.status === "OVERDUE") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        setSelectedPaymentId(p.id);
                        setPaymentForm({
                          amountCents: String(p.amountCents),
                          paidDate: new Date().toISOString().split("T")[0],
                          paymentMethod: "",
                        });
                        setRecordOpen(true);
                      }}
                    >
                      Record
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Record payment dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount (cents)</Label>
              <Input
                type="number"
                className="rounded-xl"
                value={paymentForm.amountCents}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date paid</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={paymentForm.paidDate}
                onChange={(e) => setPaymentForm((f) => ({ ...f, paidDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(v) => v !== null && setPaymentForm((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Direct debit">Direct debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)} disabled={recordPaymentMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!paymentForm.amountCents || !paymentForm.paidDate || recordPaymentMutation.isPending}
              onClick={() => {
                if (!selectedPaymentId) return;
                recordPaymentMutation.mutate({
                  id: selectedPaymentId,
                  amountCents: parseInt(paymentForm.amountCents, 10),
                  paidDate: paymentForm.paidDate,
                  paymentMethod: paymentForm.paymentMethod || undefined,
                });
              }}
            >
              {recordPaymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
