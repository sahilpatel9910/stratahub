"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { DollarSign, AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

type PaymentStatus = "ALL" | "PENDING" | "OVERDUE" | "PAID" | "PARTIAL";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
  PARTIAL: "Partial",
  WAIVED: "Waived",
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
};

function paymentStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    PARTIAL: "bg-blue-100 text-blue-800",
    WAIVED: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RentPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState("roll");
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState<PaymentStatus>("ALL");

  // Record Payment dialog
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{
    id: string;
    amountCents: number;
    tenantName: string;
    unitNumber: string;
  } | null>(null);
  const [formAmount, setFormAmount] = useState("");
  const [formPaidDate, setFormPaidDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formMethod, setFormMethod] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const utils = trpc.useUtils();

  const rentRollQuery = trpc.rent.getRentRoll.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const paymentsQuery = trpc.rent.listByBuilding.useQuery(
    selectedBuildingId
      ? {
          buildingId: selectedBuildingId,
          status:
            paymentStatusFilter === "ALL"
              ? undefined
              : (paymentStatusFilter as Exclude<PaymentStatus, "ALL">),
        }
      : skipToken,
    { placeholderData: (prev) => prev }
  );

  const recordPaymentMutation = trpc.rent.recordPayment.useMutation({
    onSuccess: () => {
      utils.rent.listByBuilding.invalidate();
      utils.rent.getRentRoll.invalidate();
      utils.buildings.getStats.invalidate();
      closeRecordDialog();
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(err.message ?? "Failed to record payment"),
  });

  function openRecordDialog(payment: {
    id: string;
    amountCents: number;
    tenantName: string;
    unitNumber: string;
  }) {
    setSelectedPayment(payment);
    setFormAmount((payment.amountCents / 100).toFixed(2));
    setFormPaidDate(new Date().toISOString().split("T")[0]);
    setFormMethod("");
    setFormNotes("");
    setRecordDialogOpen(true);
  }

  function closeRecordDialog() {
    setRecordDialogOpen(false);
    setSelectedPayment(null);
  }

  function handleRecordPayment() {
    if (!selectedPayment) return;
    const amountCents = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    recordPaymentMutation.mutate({
      id: selectedPayment.id,
      amountCents,
      paidDate: formPaidDate,
      paymentMethod: formMethod || undefined,
      notes: formNotes || undefined,
    });
  }

  const rentRoll = rentRollQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  const totalRentRoll = rentRoll.reduce(
    (sum, t) => sum + t.rentAmountCents,
    0
  );
  const overdueCount = rentRoll.filter((t) => t.overduePayments > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rent</h1>
        <p className="text-muted-foreground">
          Rent roll and payment tracking
        </p>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view rent.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monthly Rent Roll
                </CardTitle>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                {rentRollQuery.isLoading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalRentRoll)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {rentRoll.length} active tenancies
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue Tenancies
                </CardTitle>
                <div className="rounded-lg bg-red-50 p-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                {rentRollQuery.isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{overdueCount}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Tenancies with overdue payments
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Payments
                </CardTitle>
                <div className="rounded-lg bg-yellow-50 p-2">
                  <CalendarDays className="h-4 w-4 text-yellow-600" />
                </div>
              </CardHeader>
              <CardContent>
                {paymentsQuery.isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">
                    {
                      payments.filter(
                        (p) =>
                          p.status === "PENDING" || p.status === "OVERDUE"
                      ).length
                    }
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Pending or overdue invoices
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="roll">Rent Roll</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>

            {/* RENT ROLL TAB */}
            <TabsContent value="roll" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Rent</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Lease End</TableHead>
                        <TableHead>Overdue</TableHead>
                        <TableHead>Next Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentRollQuery.isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : rentRoll.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-12 text-center text-muted-foreground"
                          >
                            No active tenancies found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rentRoll.map((tenancy) => (
                          <TableRow key={tenancy.unitNumber}>
                            <TableCell className="font-semibold">
                              {tenancy.unitNumber}
                            </TableCell>
                            <TableCell>{tenancy.tenantName}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(tenancy.rentAmountCents)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {FREQUENCY_LABELS[tenancy.rentFrequency] ??
                                tenancy.rentFrequency}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(tenancy.leaseEnd)}
                            </TableCell>
                            <TableCell>
                              {tenancy.overduePayments > 0 ? (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                  {tenancy.overduePayments} overdue
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(tenancy.nextDue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PAYMENTS TAB */}
            <TabsContent value="payments" className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <Select
                  value={paymentStatusFilter}
                  onValueChange={(v) =>
                    setPaymentStatusFilter(v as PaymentStatus)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Payments</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {payments.length} payment
                  {payments.length !== 1 ? "s" : ""}
                </p>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Paid Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsQuery.isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : payments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-12 text-center text-muted-foreground"
                          >
                            No payments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-semibold">
                              {payment.tenancy.unit.unitNumber}
                            </TableCell>
                            <TableCell>
                              {payment.tenancy.user.firstName}{" "}
                              {payment.tenancy.user.lastName}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amountCents)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(payment.dueDate)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(payment.paidDate)}
                            </TableCell>
                            <TableCell>
                              {paymentStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell>
                              {(payment.status === "PENDING" ||
                                payment.status === "OVERDUE" ||
                                payment.status === "PARTIAL") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openRecordDialog({
                                      id: payment.id,
                                      amountCents: payment.amountCents,
                                      tenantName: `${payment.tenancy.user.firstName} ${payment.tenancy.user.lastName}`,
                                      unitNumber:
                                        payment.tenancy.unit.unitNumber,
                                    })
                                  }
                                >
                                  Record Payment
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedPayment && (
                <>
                  Unit {selectedPayment.unitNumber} &mdash;{" "}
                  {selectedPayment.tenantName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Received (AUD) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
              {selectedPayment && (
                <p className="text-xs text-muted-foreground">
                  Amount due:{" "}
                  {formatCurrency(selectedPayment.amountCents)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidDate">Payment Date *</Label>
              <Input
                id="paidDate"
                type="date"
                value={formPaidDate}
                onChange={(e) => setFormPaidDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Input
                id="method"
                placeholder="e.g. Bank Transfer, Direct Debit"
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRecordDialog}
              disabled={recordPaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={
                !formAmount ||
                !formPaidDate ||
                recordPaymentMutation.isPending
              }
            >
              {recordPaymentMutation.isPending
                ? "Recording..."
                : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
