"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipToken } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const CreateTenancyDialog = dynamic(() => import("./_create-tenancy-dialog"), { ssr: false });
const EditTenancyDialog = dynamic(() => import("./_edit-tenancy-dialog"), { ssr: false });
import { AlertTriangle, CalendarDays, DollarSign, Wallet, ClipboardCheck, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { formatCurrency, BOND_LODGEMENT_AUTHORITIES, AUSTRALIAN_STATES } from "@/lib/constants";
import { toast } from "sonner";

type PaymentStatus = "ALL" | "PENDING" | "OVERDUE" | "PAID" | "PARTIAL";
type RentTab = "roll" | "payments" | "setup" | "bonds" | "tenancies";
type BondStatus = "PENDING" | "LODGED" | "PARTIALLY_RELEASED" | "FULLY_RELEASED" | "DISPUTED";
type AustralianStateCode = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT";
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
  const router = useRouter();
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

  // Bond dialog state
  const [bondDialogOpen, setBondDialogOpen] = useState(false);
  const [selectedBondTenancyId, setSelectedBondTenancyId] = useState<string | null>(null);
  const [bondForm, setBondForm] = useState({
    amountCents: "",
    state: "NSW" as AustralianStateCode,
    lodgementDate: "",
    referenceNumber: "",
    status: "PENDING" as BondStatus,
    notes: "",
  });

  // Status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null);
  const [bondStatusForm, setBondStatusForm] = useState<{ status: BondStatus; notes: string }>({ status: "LODGED", notes: "" });

  // Edit tenancy dialog
  const [editTenancy, setEditTenancy] = useState<{
    id: string;
    leaseStartDate: Date;
    leaseEndDate?: Date | null;
    rentAmountCents: number;
    rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
    bondAmountCents: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  const bondsQuery = trpc.bond.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const tenancyQuery = trpc.tenancy.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );
  const tenancies = tenancyQuery.data ?? [];

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

  const upsertBondMutation = trpc.bond.upsert.useMutation({
    onSuccess: () => {
      utils.bond.listByBuilding.invalidate();
      setBondDialogOpen(false);
      setSelectedBondTenancyId(null);
      toast.success("Bond record saved");
    },
    onError: (err) => toast.error(err.message ?? "Failed to save bond record"),
  });

  const updateBondStatusMutation = trpc.bond.updateStatus.useMutation({
    onSuccess: () => {
      utils.bond.listByBuilding.invalidate();
      setStatusDialogOpen(false);
      setSelectedBondId(null);
      toast.success("Bond status updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update bond status"),
  });

  const endTenancyMutation = trpc.tenancy.end.useMutation({
    onSuccess: () => {
      toast.success("Tenancy ended");
      void utils.tenancy.listByBuilding.invalidate();
      void utils.rent.getRentRoll.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to end tenancy"),
  });

  const markOverdueMutation = trpc.rent.markOverdue.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} payment(s) marked overdue`);
      void utils.rent.listByBuilding.invalidate();
      void utils.rent.getRentRoll.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to mark overdue"),
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

  function openBondDialog(tenancyId: string, existing?: {
    amountCents: number;
    state: AustralianStateCode;
    lodgementDate: Date | null;
    referenceNumber: string | null;
    status: BondStatus;
    notes: string | null;
  }) {
    setSelectedBondTenancyId(tenancyId);
    setBondForm({
      amountCents: existing ? (existing.amountCents / 100).toFixed(2) : "",
      state: existing?.state ?? "NSW",
      lodgementDate: existing?.lodgementDate
        ? new Date(existing.lodgementDate).toISOString().split("T")[0]
        : "",
      referenceNumber: existing?.referenceNumber ?? "",
      status: existing?.status ?? "PENDING",
      notes: existing?.notes ?? "",
    });
    setBondDialogOpen(true);
  }

  function openStatusDialog(bondId: string, currentStatus: BondStatus) {
    setSelectedBondId(bondId);
    setBondStatusForm({ status: currentStatus, notes: "" });
    setStatusDialogOpen(true);
  }

  function handleUpsertBond() {
    if (!selectedBondTenancyId || !bondForm.amountCents || !bondForm.state) return;
    const amountCents = Math.round(parseFloat(bondForm.amountCents) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    upsertBondMutation.mutate({
      tenancyId: selectedBondTenancyId,
      amountCents,
      state: bondForm.state,
      lodgementDate: bondForm.lodgementDate || undefined,
      referenceNumber: bondForm.referenceNumber || undefined,
      status: bondForm.status,
      notes: bondForm.notes || undefined,
    });
  }

  function handleUpdateBondStatus() {
    if (!selectedBondId) return;
    updateBondStatusMutation.mutate({
      id: selectedBondId,
      status: bondStatusForm.status,
      notes: bondStatusForm.notes || undefined,
    });
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
  const bonds = bondsQuery.data ?? [];
  const todayISO = new Date().toISOString();
  const overdueUnlodgedBonds = bonds.filter(
    (b) => b.status === "PENDING" && b.lodgementDeadline.toISOString() < todayISO
  ).length;
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
              <RentSignal icon={ShieldCheck} label="Bonds overdue lodgement" value={`${overdueUnlodgedBonds}`} tone="text-violet-600" />
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

          <Tabs value={tab} onValueChange={(v) => setTab(v as RentTab)}>
            <TabsList className="bg-background/80">
              <TabsTrigger value="roll">Rent Roll</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="setup">Tenant Setup</TabsTrigger>
              <TabsTrigger value="bonds">Bond Tracking</TabsTrigger>
              <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
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

            {/* BOND TRACKING TAB */}
            <TabsContent value="bonds" className="mt-4 space-y-4">
              <div className="app-grid-panel flex items-center justify-between p-4">
                <p className="text-sm text-muted-foreground">
                  Track bond lodgement, reference numbers, and release status for each tenancy.
                  Lodgement deadlines are calculated per state legislation.
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
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bondsQuery.isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : bonds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                            No bond records found for this building.
                          </TableCell>
                        </TableRow>
                      ) : (
                        bonds.map((bond) => {
                          const isOverdue = bond.status === "PENDING" && bond.lodgementDeadline.toISOString() < todayISO;
                          return (
                            <TableRow key={bond.id}>
                              <TableCell className="font-semibold">
                                {bond.tenancy.unit.unitNumber}
                              </TableCell>
                              <TableCell>
                                {bond.tenancy.user.firstName} {bond.tenancy.user.lastName}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(bond.amountCents)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{bond.state}</TableCell>
                              <TableCell>{bondStatusBadge(bond.status)}</TableCell>
                              <TableCell className={isOverdue ? "font-medium text-red-600" : "text-muted-foreground"}>
                                <span className="flex items-center gap-1">
                                  {formatDate(bond.lodgementDeadline)}
                                  {isOverdue && <TriangleAlert className="h-3.5 w-3.5 text-red-600" />}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {bond.referenceNumber ?? "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openBondDialog(bond.tenancyId, {
                                      amountCents: bond.amountCents,
                                      state: bond.state as AustralianStateCode,
                                      lodgementDate: bond.lodgementDate,
                                      referenceNumber: bond.referenceNumber,
                                      status: bond.status as BondStatus,
                                      notes: bond.notes,
                                    })}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openStatusDialog(bond.id, bond.status as BondStatus)}
                                  >
                                    Status
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Tenancies without a bond record */}
              {rentRoll.length > 0 && (() => {
                const bondedTenancyIds = new Set(bonds.map((b) => b.tenancyId));
                const unbonded = rentRoll.filter((t) => !bondedTenancyIds.has(t.tenancyId));
                if (unbonded.length === 0) return null;
                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Tenancies without a bond record ({unbonded.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Unit</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Rent</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unbonded.map((t) => (
                            <TableRow key={t.tenancyId}>
                              <TableCell className="font-semibold">{t.unitNumber}</TableCell>
                              <TableCell>{t.tenantName}</TableCell>
                              <TableCell className="text-muted-foreground">{formatCurrency(t.rentAmountCents)}</TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => openBondDialog(t.tenancyId)}>
                                  Add Bond Record
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            <TabsContent value="tenancies">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {tenancies.length} active {tenancies.length === 1 ? "tenancy" : "tenancies"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={!selectedBuildingId || markOverdueMutation.isPending}
                    onClick={() => selectedBuildingId && markOverdueMutation.mutate({ buildingId: selectedBuildingId })}
                  >
                    {markOverdueMutation.isPending ? "Marking…" : "Mark Overdue"}
                  </Button>
                  <CreateTenancyDialog />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Lease End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenancyQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : tenancies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No active tenancies.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenancies.map((t) => {
                      const overdue = t.rentPayments.filter((p: { status: string }) => p.status === "OVERDUE").length;
                      return (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/manager/tenancies/${t.id}`)}
                        >
                          <TableCell className="font-medium">
                            {t.user.firstName} {t.user.lastName}
                          </TableCell>
                          <TableCell>Unit {t.unit.unitNumber}</TableCell>
                          <TableCell>
                            {formatCurrency(t.rentAmountCents)} / {t.rentFrequency.toLowerCase()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.leaseEndDate ? new Date(t.leaseEndDate).toLocaleDateString("en-AU") : "Ongoing"}
                          </TableCell>
                          <TableCell>
                            {overdue > 0 ? (
                              <Badge variant="destructive">{overdue} overdue</Badge>
                            ) : (
                              <Badge variant="outline">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() => {
                                  setEditTenancy(t);
                                  setEditOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg text-xs text-red-600 hover:bg-red-50"
                                disabled={endTenancyMutation.isPending}
                                onClick={() => {
                                  if (confirm(`End tenancy for ${t.user.firstName} ${t.user.lastName}? This cannot be undone.`)) {
                                    endTenancyMutation.mutate({ id: t.id });
                                  }
                                }}
                              >
                                End
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              <EditTenancyDialog tenancy={editTenancy} open={editOpen} onOpenChange={setEditOpen} />
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
          <div className="flex flex-col gap-5 px-7 py-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount Received (AUD) <span className="text-destructive">*</span></Label>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paidDate">Payment Date <span className="text-destructive">*</span></Label>
              <Input
                id="paidDate"
                type="date"
                className="h-11 rounded-xl bg-background"
                value={formPaidDate}
                onChange={(e) => setFormPaidDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Payment Method</Label>
              <Input
                id="method"
                className="h-11 rounded-xl bg-background"
                placeholder="e.g. Bank Transfer, Direct Debit"
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-5 px-7 py-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setupLeaseStartDate">Lease Start Date <span className="text-destructive">*</span></Label>
              <Input
                id="setupLeaseStartDate"
                type="date"
                className="h-11 rounded-xl bg-background"
                value={setupLeaseStartDate}
                onChange={(e) => setSetupLeaseStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setupLeaseEndDate">Lease End Date</Label>
              <Input
                id="setupLeaseEndDate"
                type="date"
                className="h-11 rounded-xl bg-background"
                value={setupLeaseEndDate}
                onChange={(e) => setSetupLeaseEndDate(e.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setupRentAmount">Rent Amount (AUD) <span className="text-destructive">*</span></Label>
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
              <div className="flex flex-col gap-1.5">
                <Label>Rent Frequency <span className="text-destructive">*</span></Label>
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setupBondAmount">Bond Amount (AUD) <span className="text-destructive">*</span></Label>
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
              <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
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

      {/* Bond Upsert Dialog */}
      <Dialog open={bondDialogOpen} onOpenChange={(open) => { if (!open) { setBondDialogOpen(false); setSelectedBondTenancyId(null); } }}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Bond Record</DialogTitle>
            <DialogDescription className="px-6">
              Record bond lodgement details for this tenancy.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 px-7 py-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bondAmount">Bond Amount (AUD) <span className="text-destructive">*</span></Label>
                <Input
                  id="bondAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="h-11 rounded-xl bg-background"
                  placeholder="0.00"
                  value={bondForm.amountCents}
                  onChange={(e) => setBondForm((f) => ({ ...f, amountCents: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bondState">State <span className="text-destructive">*</span></Label>
                <Select
                  value={bondForm.state}
                  onValueChange={(v) => v !== null && setBondForm((f) => ({ ...f, state: v as AustralianStateCode }))}
                >
                  <SelectTrigger id="bondState" className="h-11 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUSTRALIAN_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lodgement Authority (auto-set by state)</Label>
              <p className="rounded-xl border bg-muted/50 px-3 py-2 text-sm">
                {BOND_LODGEMENT_AUTHORITIES[bondForm.state]}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bondStatus">Status</Label>
                <Select
                  value={bondForm.status}
                  onValueChange={(v) => v !== null && setBondForm((f) => ({ ...f, status: v as BondStatus }))}
                >
                  <SelectTrigger id="bondStatus" className="h-11 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="LODGED">Lodged</SelectItem>
                    <SelectItem value="PARTIALLY_RELEASED">Partially Released</SelectItem>
                    <SelectItem value="FULLY_RELEASED">Fully Released</SelectItem>
                    <SelectItem value="DISPUTED">Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bondLodgementDate">Lodgement Date</Label>
                <Input
                  id="bondLodgementDate"
                  type="date"
                  className="h-11 rounded-xl bg-background"
                  value={bondForm.lodgementDate}
                  onChange={(e) => setBondForm((f) => ({ ...f, lodgementDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bondRef">Reference Number</Label>
              <Input
                id="bondRef"
                className="h-11 rounded-xl bg-background"
                placeholder="Authority reference number"
                value={bondForm.referenceNumber}
                onChange={(e) => setBondForm((f) => ({ ...f, referenceNumber: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bondNotes">Notes</Label>
              <Textarea
                id="bondNotes"
                className="min-h-20 rounded-xl bg-background"
                placeholder="Any additional notes..."
                value={bondForm.notes}
                onChange={(e) => setBondForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setBondDialogOpen(false)} disabled={upsertBondMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleUpsertBond}
              disabled={!bondForm.amountCents || !bondForm.state || upsertBondMutation.isPending}
            >
              {upsertBondMutation.isPending ? "Saving..." : "Save Bond Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bond Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => { if (!open) { setStatusDialogOpen(false); setSelectedBondId(null); } }}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Update Bond Status</DialogTitle>
            <DialogDescription className="px-6">
              Change the bond status and optionally add a note.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 px-7 py-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newBondStatus">New Status</Label>
              <Select
                value={bondStatusForm.status}
                onValueChange={(v) => v !== null && setBondStatusForm((f) => ({ ...f, status: v as BondStatus }))}
              >
                <SelectTrigger id="newBondStatus" className="h-11 rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="LODGED">Lodged</SelectItem>
                  <SelectItem value="PARTIALLY_RELEASED">Partially Released</SelectItem>
                  <SelectItem value="FULLY_RELEASED">Fully Released</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="statusNotes">Notes</Label>
              <Textarea
                id="statusNotes"
                className="min-h-20 rounded-xl bg-background"
                placeholder="e.g. Bond released after inspection on 15 Apr"
                value={bondStatusForm.notes}
                onChange={(e) => setBondStatusForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={updateBondStatusMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBondStatus} disabled={updateBondStatusMutation.isPending}>
              {updateBondStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function bondStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING:            "bg-yellow-100 text-yellow-800",
    LODGED:             "bg-blue-100 text-blue-800",
    PARTIALLY_RELEASED: "bg-violet-100 text-violet-800",
    FULLY_RELEASED:     "bg-green-100 text-green-800",
    DISPUTED:           "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    PENDING:            "Pending",
    LODGED:             "Lodged",
    PARTIALLY_RELEASED: "Partial Release",
    FULLY_RELEASED:     "Released",
    DISPUTED:           "Disputed",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
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
