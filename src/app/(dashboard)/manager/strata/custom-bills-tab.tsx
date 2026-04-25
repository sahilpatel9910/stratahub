"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import {
  formatCurrency,
  CUSTOM_BILL_CATEGORY_LABELS,
  CUSTOM_BILL_CATEGORY_COLORS,
} from "@/lib/constants";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "secondary" },
  PAID: { label: "Paid", variant: "default" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
  PARTIAL: { label: "Partial", variant: "outline" },
  WAIVED: { label: "Waived", variant: "outline" },
};

const CATEGORY_OPTIONS = Object.entries(CUSTOM_BILL_CATEGORY_LABELS) as [string, string][];

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  buildingId: string;
  isBuildingManager: boolean;
}

export function CustomBillsTab({ buildingId, isBuildingManager }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formUnitId, setFormUnitId] = useState("");
  const [formRecipientType, setFormRecipientType] = useState<"OWNER" | "TENANT">("OWNER");
  const [formRecipientId, setFormRecipientId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPaymentMode, setFormPaymentMode] = useState<"ONLINE" | "MANUAL">("ONLINE");

  const utils = trpc.useUtils();

  const { data: bills = [], isLoading } = trpc.customBills.listByBuilding.useQuery({
    buildingId,
    ...(statusFilter !== "ALL"
      ? { status: statusFilter as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED" }
      : {}),
  });

  const { data: unitsData } = trpc.units.listByBuilding.useQuery(
    buildingId ? { buildingId } : skipToken
  );

  const selectedUnit = (unitsData ?? []).find((u) => u.id === formUnitId);
  const owners = selectedUnit?.ownerships ?? [];
  const tenants = selectedUnit?.tenancies ?? [];
  const recipientOptions = formRecipientType === "OWNER" ? owners : tenants;

  const createMutation = trpc.customBills.create.useMutation({
    onSuccess: () => {
      utils.customBills.listByBuilding.invalidate({ buildingId });
      setDialogOpen(false);
      resetForm();
      toast.success("Bill created and resident notified");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create bill"),
  });

  const updateStatusMutation = trpc.customBills.updateStatus.useMutation({
    onSuccess: () => {
      utils.customBills.listByBuilding.invalidate({ buildingId });
      toast.success("Bill status updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update status"),
  });

  const deleteMutation = trpc.customBills.delete.useMutation({
    onSuccess: () => {
      utils.customBills.listByBuilding.invalidate({ buildingId });
      toast.success("Bill deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete bill"),
  });

  function resetForm() {
    setFormUnitId("");
    setFormRecipientType("OWNER");
    setFormRecipientId("");
    setFormTitle("");
    setFormDescription("");
    setFormCategory("");
    setFormAmount("");
    setFormDueDate("");
    setFormPaymentMode("ONLINE");
  }

  function handleCreate() {
    if (
      !formUnitId ||
      !formRecipientId ||
      formRecipientId === "_none" ||
      !formTitle ||
      !formCategory ||
      !formAmount ||
      !formDueDate
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    const amountCents = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid amount greater than $0");
      return;
    }
    createMutation.mutate({
      buildingId,
      unitId: formUnitId,
      recipientType: formRecipientType,
      recipientId: formRecipientId,
      title: formTitle,
      description: formDescription || undefined,
      category: formCategory as
        | "WATER_USAGE"
        | "PARKING_FINE"
        | "DAMAGE"
        | "CLEANING"
        | "MAINTENANCE_CHARGEBACK"
        | "MOVE_IN_FEE"
        | "MOVE_OUT_FEE"
        | "KEY_REPLACEMENT"
        | "DOCUMENT_FEE"
        | "ADMIN_FEE"
        | "OTHER",
      amountCents,
      dueDate: formDueDate,
      paymentMode: formPaymentMode,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["ALL", "PENDING", "OVERDUE", "PAID"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "ALL" ? "All" : (STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Bill
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : bills.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No custom bills found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Bill</TableHead>
                  <TableHead className="px-4 py-3">Unit</TableHead>
                  <TableHead className="px-4 py-3">Recipient</TableHead>
                  <TableHead className="px-4 py-3">Category</TableHead>
                  <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                  <TableHead className="px-4 py-3">Due</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3">Payment</TableHead>
                  <TableHead className="px-4 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="px-4 py-3">
                      <div className="font-medium">{bill.title}</div>
                      {bill.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {bill.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {bill.unitNumber}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {bill.recipientName}
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
                      {formatDate(bill.dueDate)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={STATUS_CONFIG[bill.status]?.variant ?? "outline"}>
                        {STATUS_CONFIG[bill.status]?.label ?? bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {bill.paymentMode === "ONLINE" ? "Online" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {bill.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs text-orange-600 hover:text-orange-700"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({ id: bill.id, status: "OVERDUE" })
                            }
                          >
                            Mark Overdue
                          </Button>
                        )}
                        {bill.status !== "PAID" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs text-green-700 hover:text-green-800"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({ id: bill.id, status: "PAID" })
                            }
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Mark Paid
                          </Button>
                        )}
                        {isBuildingManager && (
                          deleteConfirmId === bill.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  deleteMutation.mutate({ id: bill.id });
                                  setDeleteConfirmId(null);
                                }}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              aria-label={`Delete bill: ${bill.title}`}
                              onClick={() => setDeleteConfirmId(bill.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Custom Bill</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-[18px] overflow-y-auto px-7 py-5">
            <div className="grid gap-1.5">
              <Label>Unit *</Label>
              <Select
                value={formUnitId}
                onValueChange={(v) => {
                  if (v !== null) {
                    setFormUnitId(v);
                    setFormRecipientId("");
                  }
                }}
                itemToStringLabel={(v) => {
                  const u = (unitsData ?? []).find((u) => u.id === v);
                  if (!u) return String(v);
                  const owner = u.ownerships?.[0]?.user;
                  const tenant = u.tenancies?.[0]?.user;
                  const name = owner
                    ? `${owner.firstName} ${owner.lastName}`
                    : tenant
                    ? `${tenant.firstName} ${tenant.lastName}`
                    : null;
                  return name ? `Unit ${u.unitNumber} — ${name}` : `Unit ${u.unitNumber}`;
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent className="min-w-[320px]">
                  {(unitsData ?? []).map((u) => {
                    const owner = u.ownerships?.[0]?.user;
                    const tenant = u.tenancies?.[0]?.user;
                    const residentName = owner
                      ? `${owner.firstName} ${owner.lastName}`
                      : tenant
                      ? `${tenant.firstName} ${tenant.lastName}`
                      : null;
                    const label = residentName
                      ? `Unit ${u.unitNumber} — ${residentName}`
                      : `Unit ${u.unitNumber}`;
                    return (
                      <SelectItem key={u.id} value={u.id} label={label}>
                        <span>Unit {u.unitNumber}</span>
                        {residentName && (
                          <span className="ml-1.5 text-muted-foreground">— {residentName}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Bill recipient *</Label>
              <div className="flex h-11 gap-2">
                {(["OWNER", "TENANT"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFormRecipientType(type);
                      setFormRecipientId("");
                    }}
                    className={`flex-1 rounded-[10px] border text-sm font-medium transition-colors ${
                      formRecipientType === type
                        ? "border-foreground bg-muted font-semibold"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {type === "OWNER" ? "Owner" : "Tenant"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>{formRecipientType === "OWNER" ? "Owner" : "Tenant"} *</Label>
              <Select
                value={formRecipientId}
                disabled={!formUnitId}
                onValueChange={(v) => v !== null && setFormRecipientId(v)}
                itemToStringLabel={(v) => {
                  const r = recipientOptions.find((r) => r.user.id === v);
                  return r ? `${r.user.firstName} ${r.user.lastName}` : String(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formUnitId ? "Select person" : "Select a unit first"} />
                </SelectTrigger>
                <SelectContent>
                  {recipientOptions.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No active {formRecipientType === "OWNER" ? "owners" : "tenants"} for this unit
                    </div>
                  ) : (
                    recipientOptions.map((r) => (
                      <SelectItem
                        key={r.user.id}
                        value={r.user.id}
                        label={`${r.user.firstName} ${r.user.lastName}`}
                      >
                        {r.user.firstName} {r.user.lastName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Water Usage – March 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                placeholder="Additional details for the resident…"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category *</Label>
                <Select
                  value={formCategory}
                  onValueChange={(v) => v !== null && setFormCategory(v)}
                  itemToStringLabel={(v) => CUSTOM_BILL_CATEGORY_LABELS[v] ?? String(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value} label={label}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Amount (AUD) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Payment Mode *</Label>
                <div className="flex h-11 gap-2">
                  {(["ONLINE", "MANUAL"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFormPaymentMode(mode)}
                      className={`flex-1 rounded-[10px] border text-sm font-medium transition-colors ${
                        formPaymentMode === mode
                          ? "border-foreground bg-muted font-semibold"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      {mode === "ONLINE" ? "Online" : "Manual"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Resident will receive an in-app notification and email when this bill is
              created.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
