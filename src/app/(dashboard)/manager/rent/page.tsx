"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, DollarSign, Wallet, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
type RentTab = "roll" | "payments" | "setup";
type RentFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

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
  const [tab, setTab] = useState<RentTab>("roll");
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

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedTenancy, setSelectedTenancy] = useState<{
    id: string;
    tenantName: string;
    unitNumber: string;
    leaseStartDate: string;
  } | null>(null);
  const [setupLeaseStartDate, setSetupLeaseStartDate] = useState("");
  const [setupLeaseEndDate, setSetupLeaseEndDate] = useState("");
  const [setupRentAmount, setSetupRentAmount] = useState("");
  const [setupRentFrequency, setSetupRentFrequency] = useState<RentFrequency>("MONTHLY");
  const [setupBondAmount, setSetupBondAmount] = useState("");
  const [setupMoveInDate, setSetupMoveInDate] = useState("");
  const [setupScheduleMonths, setSetupScheduleMonths] = useState("12");

  const utils = trpc.useUtils();

  const rentRollQuery = trpc.rent.getRentRoll.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const paymentsQuery = trpc.rent.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );
  const pendingSetupQuery = trpc.rent.listPendingSetupByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
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

  const completeTenancySetupMutation = trpc.rent.completeTenancySetup.useMutation({
    onSuccess: () => {
      utils.rent.listPendingSetupByBuilding.invalidate();
      utils.rent.getRentRoll.invalidate();
      utils.rent.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      closeSetupDialog();
      toast.success("Tenant setup completed");
    },
    onError: (err) => toast.error(err.message ?? "Failed to complete tenant setup"),
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

  function openSetupDialog(tenancy: {
    id: string;
    user: { firstName: string; lastName: string };
    unit: { unitNumber: string };
    leaseStartDate: Date | string;
  }) {
    const leaseStart = new Date(tenancy.leaseStartDate).toISOString().split("T")[0];
    setSelectedTenancy({
      id: tenancy.id,
      tenantName: `${tenancy.user.firstName} ${tenancy.user.lastName}`,
      unitNumber: tenancy.unit.unitNumber,
      leaseStartDate: leaseStart,
    });
    setSetupLeaseStartDate(leaseStart);
    setSetupLeaseEndDate("");
    setSetupRentAmount("");
    setSetupRentFrequency("MONTHLY");
    setSetupBondAmount("");
    setSetupMoveInDate(leaseStart);
    setSetupScheduleMonths("12");
    setSetupDialogOpen(true);
  }

  function closeSetupDialog() {
    setSetupDialogOpen(false);
    setSelectedTenancy(null);
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

  function handleCompleteSetup() {
    if (!selectedTenancy || !setupLeaseStartDate || !setupRentAmount || !setupBondAmount) {
      return;
    }

    completeTenancySetupMutation.mutate({
      tenancyId: selectedTenancy.id,
      leaseStartDate: new Date(setupLeaseStartDate),
      leaseEndDate: setupLeaseEndDate ? new Date(setupLeaseEndDate) : null,
      rentAmountCents: Math.round(parseFloat(setupRentAmount) * 100),
      rentFrequency: setupRentFrequency,
      bondAmountCents: Math.round(parseFloat(setupBondAmount) * 100),
      moveInDate: setupMoveInDate ? new Date(setupMoveInDate) : null,
      createSchedule: true,
      scheduleMonths: parseInt(setupScheduleMonths, 10) || 12,
    });
  }

  const rentRoll = rentRollQuery.data ?? [];
  const allPayments = paymentsQuery.data ?? [];
  const pendingSetups = pendingSetupQuery.data ?? [];
  const payments =
    paymentStatusFilter === "ALL"
      ? allPayments
      : allPayments.filter((payment) => payment.status === paymentStatusFilter);

  const totalRentRoll = rentRoll.reduce(
    (sum, t) => sum + t.rentAmountCents,
    0
  );
  const overdueCount = rentRoll.filter((t) => t.overduePayments > 0).length;
  const pendingInvoiceCount = allPayments.filter(
    (payment) => payment.status === "PENDING" || payment.status === "OVERDUE"
  ).length;

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Rent roll and collection tracking
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Monitor active tenancies, spot overdue balances quickly, and record payments without leaving the workflow.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Collection status</p>
            <div className="mt-4 space-y-3">
              <RentSignal icon={DollarSign} label="Monthly rent roll" value={formatCurrency(totalRentRoll)} tone="text-emerald-600" />
              <RentSignal icon={AlertTriangle} label="Overdue tenancies" value={`${overdueCount}`} tone="text-red-600" />
              <RentSignal icon={Wallet} label="Pending invoices" value={`${pendingInvoiceCount}`} tone="text-amber-600" />
              <RentSignal icon={ClipboardCheck} label="Setup needed" value={`${pendingSetups.length}`} tone="text-sky-600" />
            </div>
          </div>
        </div>
      </section>

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
                    {pendingInvoiceCount}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Pending or overdue invoices
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-background/80">
              <TabsTrigger value="roll">Rent Roll</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="setup">Tenant Setup</TabsTrigger>
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
              <div className="app-grid-panel flex items-center gap-3 p-4">
                <Select
                  value={paymentStatusFilter}
                  onValueChange={(v) =>
                    setPaymentStatusFilter(v as PaymentStatus)
                  }
                >
                  <SelectTrigger className="h-11 w-40 rounded-xl bg-background">
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

            <TabsContent value="setup" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Invite Accepted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSetupQuery.isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : pendingSetups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                            No tenant setups are waiting for completion.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingSetups.map((tenancy) => (
                          <TableRow key={tenancy.id}>
                            <TableCell className="font-semibold">
                              {tenancy.unit.unitNumber}
                            </TableCell>
                            <TableCell>
                              {tenancy.user.firstName} {tenancy.user.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(tenancy.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                                Setup required
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSetupDialog(tenancy)}
                              >
                                Complete Setup
                              </Button>
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
        <DialogContent className="max-w-lg p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Record Payment</DialogTitle>
            <DialogDescription className="px-6">
              {selectedPayment && (
                <>
                  Unit {selectedPayment.unitNumber} &mdash;{" "}
                  {selectedPayment.tenantName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Received (AUD) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                className="h-11 rounded-xl bg-background"
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
                className="h-11 rounded-xl bg-background"
                value={formPaidDate}
                onChange={(e) => setFormPaidDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Input
                id="method"
                className="h-11 rounded-xl bg-background"
                placeholder="e.g. Bank Transfer, Direct Debit"
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                className="min-h-24 rounded-xl bg-background"
                placeholder="Any additional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="px-6">
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

      <Dialog
        open={setupDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setSetupDialogOpen(true);
            return;
          }
          closeSetupDialog();
        }}
      >
        <DialogContent className="max-w-lg p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Complete Tenant Setup</DialogTitle>
            <DialogDescription className="px-6">
              {selectedTenancy && (
                <>
                  Unit {selectedTenancy.unitNumber} — {selectedTenancy.tenantName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="setupLeaseStartDate">Lease Start Date *</Label>
              <Input
                id="setupLeaseStartDate"
                type="date"
                className="h-11 rounded-xl bg-background"
                value={setupLeaseStartDate}
                onChange={(e) => setSetupLeaseStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupLeaseEndDate">Lease End Date</Label>
              <Input
                id="setupLeaseEndDate"
                type="date"
                className="h-11 rounded-xl bg-background"
                value={setupLeaseEndDate}
                onChange={(e) => setSetupLeaseEndDate(e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="setupRentAmount">Rent Amount (AUD) *</Label>
                <Input
                  id="setupRentAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="h-11 rounded-xl bg-background"
                  placeholder="0.00"
                  value={setupRentAmount}
                  onChange={(e) => setSetupRentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rent Frequency *</Label>
                <Select
                  value={setupRentFrequency}
                  onValueChange={(v) => setSetupRentFrequency(v as RentFrequency)}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="setupBondAmount">Bond Amount (AUD) *</Label>
                <Input
                  id="setupBondAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-11 rounded-xl bg-background"
                  placeholder="0.00"
                  value={setupBondAmount}
                  onChange={(e) => setSetupBondAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setupMoveInDate">Move In Date</Label>
                <Input
                  id="setupMoveInDate"
                  type="date"
                  className="h-11 rounded-xl bg-background"
                  value={setupMoveInDate}
                  onChange={(e) => setSetupMoveInDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupScheduleMonths">Initial Schedule (months)</Label>
              <Input
                id="setupScheduleMonths"
                type="number"
                min="1"
                max="24"
                className="h-11 rounded-xl bg-background"
                value={setupScheduleMonths}
                onChange={(e) => setSetupScheduleMonths(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This creates the first rent schedule only when no payments exist yet for the tenancy.
              </p>
            </div>
          </div>
          <DialogFooter className="px-6">
            <Button
              variant="outline"
              onClick={closeSetupDialog}
              disabled={completeTenancySetupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteSetup}
              disabled={
                !setupLeaseStartDate ||
                !setupRentAmount ||
                !setupBondAmount ||
                completeTenancySetupMutation.isPending
              }
            >
              {completeTenancySetupMutation.isPending ? "Saving..." : "Complete Setup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RentSignal({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
