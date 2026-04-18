"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Landmark, Calendar, CheckCircle, AlertCircle, Clock, Layers, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

const LEVY_TYPE_LABELS: Record<string, string> = {
  ADMIN_FUND: "Admin Fund",
  CAPITAL_WORKS: "Capital Works",
  SPECIAL_LEVY: "Special Levy",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING:  { label: "Pending",  variant: "secondary" },
  PAID:     { label: "Paid",     variant: "default" },
  OVERDUE:  { label: "Overdue",  variant: "destructive" },
  PARTIAL:  { label: "Partial",  variant: "outline" },
  WAIVED:   { label: "Waived",   variant: "outline" },
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StrataPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState("info");
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  // Info form state
  const [formPlanNo, setFormPlanNo] = useState("");
  const [formManagerName, setFormManagerName] = useState("");
  const [formManagerEmail, setFormManagerEmail] = useState("");
  const [formManagerPhone, setFormManagerPhone] = useState("");
  const [formAdminFund, setFormAdminFund] = useState("");
  const [formCapitalWorks, setFormCapitalWorks] = useState("");
  const [formInsuranceNo, setFormInsuranceNo] = useState("");
  const [formInsuranceExpiry, setFormInsuranceExpiry] = useState("");
  const [formNextAgm, setFormNextAgm] = useState("");

  // Meeting form state
  const [formMeetingTitle, setFormMeetingTitle] = useState("");
  const [formMeetingDate, setFormMeetingDate] = useState("");
  const [formMeetingLocation, setFormMeetingLocation] = useState("");
  const [formMeetingNotes, setFormMeetingNotes] = useState("");

  // Bylaw dialog state
  const [bylawOpen, setBylawOpen] = useState(false);
  const [editingBylaw, setEditingBylaw] = useState<{ id: string; bylawNumber: number; title: string; content: string; effectiveDate: string } | null>(null);
  const [deletingBylawId, setDeletingBylawId] = useState<string | null>(null);
  const [formBylawNumber, setFormBylawNumber] = useState("");
  const [formBylawTitle, setFormBylawTitle] = useState("");
  const [formBylawContent, setFormBylawContent] = useState("");
  const [formBylawEffectiveDate, setFormBylawEffectiveDate] = useState("");

  // Levy dialog state
  const [levyOpen, setLevyOpen] = useState(false);
  const [bulkLevyOpen, setBulkLevyOpen] = useState(false);
  const [levyUnitId, setLevyUnitId] = useState("");
  const [levyType, setLevyType] = useState("ADMIN_FUND");
  const [levyAmount, setLevyAmount] = useState("");
  const [levyQuarterStart, setLevyQuarterStart] = useState("");
  const [levyDueDate, setLevyDueDate] = useState("");
  const [bulkLevyType, setBulkLevyType] = useState("ADMIN_FUND");
  const [bulkLevyAmount, setBulkLevyAmount] = useState("");
  const [bulkLevyQuarterStart, setBulkLevyQuarterStart] = useState("");
  const [bulkLevyDueDate, setBulkLevyDueDate] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.strata.getByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const upsertMutation = trpc.strata.upsertInfo.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setEditInfoOpen(false);
      toast.success("Strata info saved");
    },
    onError: (err) => toast.error(err.message ?? "Failed to save strata info"),
  });

  const createMeetingMutation = trpc.strata.createMeeting.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setMeetingOpen(false);
      resetMeetingForm();
      toast.success("Meeting added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add meeting"),
  });

  const deleteMeetingMutation = trpc.strata.deleteMeeting.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      toast.success("Meeting deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete meeting"),
  });

  const createBylawMutation = trpc.strata.createBylaw.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setBylawOpen(false);
      resetBylawForm();
      toast.success("Bylaw added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add bylaw"),
  });

  const updateBylawMutation = trpc.strata.updateBylaw.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setBylawOpen(false);
      setEditingBylaw(null);
      resetBylawForm();
      toast.success("Bylaw updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update bylaw"),
  });

  const deleteBylawMutation = trpc.strata.deleteBylaw.useMutation({
    onSuccess: () => {
      utils.strata.getByBuilding.invalidate();
      setDeletingBylawId(null);
      toast.success("Bylaw deleted");
    },
    onError: (err) => {
      setDeletingBylawId(null);
      toast.error(err.message ?? "Failed to delete bylaw");
    },
  });

  const leviesQuery = trpc.strata.listLevies.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createLevyMutation = trpc.strata.createLevy.useMutation({
    onSuccess: () => {
      utils.strata.listLevies.invalidate();
      setLevyOpen(false);
      resetLevyForm();
      toast.success("Levy created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create levy"),
  });

  const bulkCreateMutation = trpc.strata.bulkCreateLevies.useMutation({
    onSuccess: (data) => {
      utils.strata.listLevies.invalidate();
      setBulkLevyOpen(false);
      resetBulkLevyForm();
      toast.success(`Levies raised for ${data.count} units`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to raise levies"),
  });

  const updateLevyStatusMutation = trpc.strata.updateLevyStatus.useMutation({
    onSuccess: () => {
      utils.strata.listLevies.invalidate();
      toast.success("Levy updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update levy"),
  });

  const deleteLevyMutation = trpc.strata.deleteLevy.useMutation({
    onSuccess: () => {
      utils.strata.listLevies.invalidate();
      toast.success("Levy deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete levy"),
  });

  const strataInfo = query.data;

  function seedInfoForm() {
    if (strataInfo) {
      setFormPlanNo(strataInfo.strataPlanNumber ?? "");
      setFormManagerName(strataInfo.strataManagerName ?? "");
      setFormManagerEmail(strataInfo.strataManagerEmail ?? "");
      setFormManagerPhone(strataInfo.strataManagerPhone ?? "");
      setFormAdminFund(
        strataInfo.adminFundBalance != null
          ? String(strataInfo.adminFundBalance / 100)
          : ""
      );
      setFormCapitalWorks(
        strataInfo.capitalWorksBalance != null
          ? String(strataInfo.capitalWorksBalance / 100)
          : ""
      );
      setFormInsuranceNo(strataInfo.insurancePolicyNo ?? "");
      setFormInsuranceExpiry(toInputDate(strataInfo.insuranceExpiry));
      setFormNextAgm(toInputDate(strataInfo.nextAgmDate));
      return;
    }

    setFormPlanNo("");
    setFormManagerName("");
    setFormManagerEmail("");
    setFormManagerPhone("");
    setFormAdminFund("");
    setFormCapitalWorks("");
    setFormInsuranceNo("");
    setFormInsuranceExpiry("");
    setFormNextAgm("");
  }

  function handleEditInfoOpenChange(open: boolean) {
    if (open) seedInfoForm();
    setEditInfoOpen(open);
  }

  function resetMeetingForm() {
    setFormMeetingTitle("");
    setFormMeetingDate("");
    setFormMeetingLocation("");
    setFormMeetingNotes("");
  }

  function resetLevyForm() {
    setLevyUnitId("");
    setLevyType("ADMIN_FUND");
    setLevyAmount("");
    setLevyQuarterStart("");
    setLevyDueDate("");
  }

  function resetBulkLevyForm() {
    setBulkLevyType("ADMIN_FUND");
    setBulkLevyAmount("");
    setBulkLevyQuarterStart("");
    setBulkLevyDueDate("");
  }

  function resetBylawForm() {
    setFormBylawNumber("");
    setFormBylawTitle("");
    setFormBylawContent("");
    setFormBylawEffectiveDate("");
  }

  function openAddBylaw() {
    setEditingBylaw(null);
    resetBylawForm();
    setBylawOpen(true);
  }

  function openEditBylaw(b: { id: string; bylawNumber: number; title: string; content: string; effectiveDate: Date | string }) {
    setEditingBylaw({
      id: b.id,
      bylawNumber: b.bylawNumber,
      title: b.title,
      content: b.content,
      effectiveDate: toInputDate(b.effectiveDate),
    });
    setFormBylawNumber(String(b.bylawNumber));
    setFormBylawTitle(b.title);
    setFormBylawContent(b.content);
    setFormBylawEffectiveDate(toInputDate(b.effectiveDate));
    setBylawOpen(true);
  }

  function handleSaveBylaw() {
    if (!selectedBuildingId || !formBylawNumber || !formBylawTitle.trim() || !formBylawContent.trim() || !formBylawEffectiveDate) return;
    const bylawNumber = parseInt(formBylawNumber, 10);
    if (isNaN(bylawNumber) || bylawNumber < 1) return;

    if (editingBylaw) {
      updateBylawMutation.mutate({
        id: editingBylaw.id,
        bylawNumber,
        title: formBylawTitle.trim(),
        content: formBylawContent.trim(),
        effectiveDate: formBylawEffectiveDate,
      });
    } else {
      createBylawMutation.mutate({
        buildingId: selectedBuildingId,
        bylawNumber,
        title: formBylawTitle.trim(),
        content: formBylawContent.trim(),
        effectiveDate: formBylawEffectiveDate,
      });
    }
  }

  function handleCreateLevy() {
    if (!selectedBuildingId || !levyUnitId || !levyAmount || !levyQuarterStart || !levyDueDate) return;
    createLevyMutation.mutate({
      buildingId: selectedBuildingId,
      unitId: levyUnitId,
      levyType: levyType as "ADMIN_FUND" | "CAPITAL_WORKS" | "SPECIAL_LEVY",
      amountCents: Math.round(parseFloat(levyAmount) * 100),
      quarterStart: levyQuarterStart,
      dueDate: levyDueDate,
    });
  }

  function handleBulkCreate() {
    if (!selectedBuildingId || !bulkLevyAmount || !bulkLevyQuarterStart || !bulkLevyDueDate) return;
    bulkCreateMutation.mutate({
      buildingId: selectedBuildingId,
      levyType: bulkLevyType as "ADMIN_FUND" | "CAPITAL_WORKS" | "SPECIAL_LEVY",
      amountCents: Math.round(parseFloat(bulkLevyAmount) * 100),
      quarterStart: bulkLevyQuarterStart,
      dueDate: bulkLevyDueDate,
    });
  }

  function handleSaveInfo() {
    if (!selectedBuildingId || !formPlanNo.trim()) return;
    upsertMutation.mutate({
      buildingId: selectedBuildingId,
      strataPlanNumber: formPlanNo.trim(),
      strataManagerName: formManagerName.trim() || undefined,
      strataManagerEmail: formManagerEmail.trim() || undefined,
      strataManagerPhone: formManagerPhone.trim() || undefined,
      adminFundBalance: formAdminFund
        ? Math.round(parseFloat(formAdminFund) * 100)
        : undefined,
      capitalWorksBalance: formCapitalWorks
        ? Math.round(parseFloat(formCapitalWorks) * 100)
        : undefined,
      insurancePolicyNo: formInsuranceNo.trim() || undefined,
      insuranceExpiry: formInsuranceExpiry || undefined,
      nextAgmDate: formNextAgm || undefined,
    });
  }

  function handleAddMeeting() {
    if (!selectedBuildingId || !formMeetingTitle.trim() || !formMeetingDate) return;
    createMeetingMutation.mutate({
      buildingId: selectedBuildingId,
      title: formMeetingTitle.trim(),
      meetingDate: formMeetingDate,
      location: formMeetingLocation.trim() || undefined,
      notes: formMeetingNotes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strata</h1>
          <p className="text-muted-foreground">
            Manage strata plan details, levies, bylaws, and meetings
          </p>
        </div>
        <Button
          onClick={() => handleEditInfoOpenChange(true)}
          disabled={!selectedBuildingId}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {strataInfo ? "Edit Info" : "Set Up Strata"}
        </Button>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view strata details.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="levies">Levies</TabsTrigger>
            <TabsTrigger value="bylaws">Bylaws</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="mt-4">
            {query.isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full max-w-sm" />
                  ))}
                </CardContent>
              </Card>
            ) : !strataInfo ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Landmark className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    Strata information has not been configured for this building.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleEditInfoOpenChange(true)}
                  >
                    Set Up Strata
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Strata Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow label="Plan Number" value={strataInfo.strataPlanNumber} />
                    <InfoRow label="Manager" value={strataInfo.strataManagerName} />
                    <InfoRow label="Email" value={strataInfo.strataManagerEmail} />
                    <InfoRow label="Phone" value={strataInfo.strataManagerPhone} />
                    <InfoRow label="Next AGM" value={formatDate(strataInfo.nextAgmDate)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Finances &amp; Insurance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <InfoRow
                      label="Admin Fund"
                      value={
                        strataInfo.adminFundBalance != null
                          ? formatCurrency(strataInfo.adminFundBalance)
                          : null
                      }
                    />
                    <InfoRow
                      label="Capital Works Fund"
                      value={
                        strataInfo.capitalWorksBalance != null
                          ? formatCurrency(strataInfo.capitalWorksBalance)
                          : null
                      }
                    />
                    <InfoRow label="Insurance Policy" value={strataInfo.insurancePolicyNo} />
                    <InfoRow
                      label="Insurance Expiry"
                      value={formatDate(strataInfo.insuranceExpiry)}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setMeetingOpen(true)}
                disabled={!strataInfo}
                title={!strataInfo ? "Set up strata info first" : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Meeting
              </Button>
            </div>
            {query.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !strataInfo?.meetings.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-muted-foreground text-sm">
                    No meetings recorded.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {strataInfo.meetings.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatDate(m.meetingDate)}
                            {m.location && ` · ${m.location}`}
                          </p>
                          {m.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {m.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          disabled={deleteMeetingMutation.isPending}
                          onClick={() =>
                            deleteMeetingMutation.mutate({ id: m.id })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Levies Tab */}
          <TabsContent value="levies" className="mt-4">
            {(() => {
              const levies = leviesQuery.data ?? [];
              const totalRaised = levies.reduce((s, l) => s + l.amountCents, 0);
              const totalPaid = levies
                .filter((l) => l.status === "PAID")
                .reduce((s, l) => s + l.amountCents, 0);
              const totalOutstanding = levies
                .filter((l) => l.status === "PENDING" || l.status === "OVERDUE" || l.status === "PARTIAL")
                .reduce((s, l) => s + l.amountCents, 0);

              return (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Raised</p>
                        <p className="text-xl font-bold">{formatCurrency(totalRaised)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{levies.length} levies</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Collected</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {levies.filter((l) => l.status === "PAID").length} paid
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {levies.filter((l) => ["PENDING", "OVERDUE", "PARTIAL"].includes(l.status)).length} unpaid
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setLevyOpen(true)}
                      disabled={!strataInfo}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Individual Levy
                    </Button>
                    <Button
                      onClick={() => setBulkLevyOpen(true)}
                      disabled={!strataInfo}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Raise Quarterly Levy
                    </Button>
                  </div>

                  {/* Levy list */}
                  {leviesQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-full" /></CardContent></Card>
                      ))}
                    </div>
                  ) : levies.length === 0 ? (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          No levies yet. Use &quot;Raise Quarterly Levy&quot; to create levies for all units at once.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quarter</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {levies.map((levy) => {
                            const sc = STATUS_CONFIG[levy.status] ?? STATUS_CONFIG.PENDING;
                            return (
                              <tr key={levy.id} className="bg-white hover:bg-muted/20">
                                <td className="px-4 py-3 font-medium">Unit {levy.unitNumber}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {LEVY_TYPE_LABELS[levy.levyType] ?? levy.levyType}
                                </td>
                                <td className="px-4 py-3 font-medium">{formatCurrency(levy.amountCents)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{formatDate(levy.quarterStart)}</td>
                                <td className="px-4 py-3 text-muted-foreground">{formatDate(levy.dueDate)}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={sc.variant}>{sc.label}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 justify-end">
                                    {levy.status !== "PAID" && levy.status !== "WAIVED" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        disabled={updateLevyStatusMutation.isPending}
                                        onClick={() =>
                                          updateLevyStatusMutation.mutate({ id: levy.id, status: "PAID" })
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Mark Paid
                                      </Button>
                                    )}
                                    {levy.status === "PENDING" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                        disabled={updateLevyStatusMutation.isPending}
                                        onClick={() =>
                                          updateLevyStatusMutation.mutate({ id: levy.id, status: "OVERDUE" })
                                        }
                                      >
                                        <Clock className="h-4 w-4 mr-1" />
                                        Overdue
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                      disabled={deleteLevyMutation.isPending}
                                      onClick={() => deleteLevyMutation.mutate({ id: levy.id })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Bylaws Tab */}
          <TabsContent value="bylaws" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={openAddBylaw}
                  disabled={!strataInfo}
                  title={!strataInfo ? "Set up strata info first" : undefined}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Bylaw
                </Button>
              </div>
              {query.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-5 w-48 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !strataInfo?.bylaws.length ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-muted-foreground text-sm">No bylaws recorded.</p>
                    {strataInfo && (
                      <Button className="mt-4" variant="outline" onClick={openAddBylaw}>
                        Add First Bylaw
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {strataInfo.bylaws.map((b) => (
                    <Card key={b.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {b.bylawNumber}. {b.title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {b.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Effective {formatDate(b.effectiveDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditBylaw(b)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              disabled={deletingBylawId === b.id}
                              onClick={() => {
                                setDeletingBylawId(b.id);
                                deleteBylawMutation.mutate({ id: b.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Info Dialog */}
      <Dialog open={editInfoOpen} onOpenChange={handleEditInfoOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strata Information</DialogTitle>
            <DialogDescription>
              Configure the strata plan details for this building
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="planNo">Strata Plan Number *</Label>
              <Input
                id="planNo"
                placeholder="e.g. SP 12345"
                value={formPlanNo}
                onChange={(e) => setFormPlanNo(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mgName">Manager Name</Label>
                <Input
                  id="mgName"
                  value={formManagerName}
                  onChange={(e) => setFormManagerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgPhone">Manager Phone</Label>
                <Input
                  id="mgPhone"
                  value={formManagerPhone}
                  onChange={(e) => setFormManagerPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mgEmail">Manager Email</Label>
              <Input
                id="mgEmail"
                type="email"
                value={formManagerEmail}
                onChange={(e) => setFormManagerEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFund">Admin Fund Balance ($)</Label>
                <Input
                  id="adminFund"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formAdminFund}
                  onChange={(e) => setFormAdminFund(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capWorks">Capital Works Balance ($)</Label>
                <Input
                  id="capWorks"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formCapitalWorks}
                  onChange={(e) => setFormCapitalWorks(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insNo">Insurance Policy No.</Label>
                <Input
                  id="insNo"
                  value={formInsuranceNo}
                  onChange={(e) => setFormInsuranceNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insExpiry">Insurance Expiry</Label>
                <Input
                  id="insExpiry"
                  type="date"
                  value={formInsuranceExpiry}
                  onChange={(e) => setFormInsuranceExpiry(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextAgm">Next AGM Date</Label>
              <Input
                id="nextAgm"
                type="date"
                value={formNextAgm}
                onChange={(e) => setFormNextAgm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleEditInfoOpenChange(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveInfo}
              disabled={!formPlanNo.trim() || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Individual Levy Dialog */}
      <Dialog open={levyOpen} onOpenChange={setLevyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Individual Levy</DialogTitle>
            <DialogDescription>Create a levy for a specific unit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select onValueChange={(v) => setLevyUnitId(String(v ?? ""))} itemToStringLabel={(v) => { const u = (unitsQuery.data ?? []).find(u => u.id === v); return u ? `Unit ${u.unitNumber}` : String(v); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {(unitsQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id} label={`Unit ${u.unitNumber}`}>Unit {u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Levy Type *</Label>
              <Select defaultValue="ADMIN_FUND" onValueChange={(v) => v !== null && setLevyType(v)} itemToStringLabel={(v) => ({ ADMIN_FUND: "Admin Fund", CAPITAL_WORKS: "Capital Works", SPECIAL_LEVY: "Special Levy" })[v] ?? String(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN_FUND" label="Admin Fund">Admin Fund</SelectItem>
                  <SelectItem value="CAPITAL_WORKS" label="Capital Works">Capital Works</SelectItem>
                  <SelectItem value="SPECIAL_LEVY" label="Special Levy">Special Levy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lvAmount">Amount ($) *</Label>
              <Input
                id="lvAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={levyAmount}
                onChange={(e) => setLevyAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lvQStart">Quarter Start *</Label>
                <Input id="lvQStart" type="date" value={levyQuarterStart} onChange={(e) => setLevyQuarterStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lvDue">Due Date *</Label>
                <Input id="lvDue" type="date" value={levyDueDate} onChange={(e) => setLevyDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLevyOpen(false); resetLevyForm(); }} disabled={createLevyMutation.isPending}>Cancel</Button>
            <Button
              onClick={handleCreateLevy}
              disabled={!levyUnitId || !levyAmount || !levyQuarterStart || !levyDueDate || createLevyMutation.isPending}
            >
              {createLevyMutation.isPending ? "Creating..." : "Create Levy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk / Raise Quarterly Levy Dialog */}
      <Dialog open={bulkLevyOpen} onOpenChange={setBulkLevyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Quarterly Levy</DialogTitle>
            <DialogDescription>
              Creates levies for <strong>all units</strong> in this building at the specified amount
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Levy Type *</Label>
              <Select defaultValue="ADMIN_FUND" onValueChange={(v) => v !== null && setBulkLevyType(v)} itemToStringLabel={(v) => ({ ADMIN_FUND: "Admin Fund", CAPITAL_WORKS: "Capital Works", SPECIAL_LEVY: "Special Levy" })[v] ?? String(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN_FUND" label="Admin Fund">Admin Fund</SelectItem>
                  <SelectItem value="CAPITAL_WORKS" label="Capital Works">Capital Works</SelectItem>
                  <SelectItem value="SPECIAL_LEVY" label="Special Levy">Special Levy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blkAmount">Amount per Unit ($) *</Label>
              <Input
                id="blkAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={bulkLevyAmount}
                onChange={(e) => setBulkLevyAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="blkQStart">Quarter Start *</Label>
                <Input id="blkQStart" type="date" value={bulkLevyQuarterStart} onChange={(e) => setBulkLevyQuarterStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blkDue">Due Date *</Label>
                <Input id="blkDue" type="date" value={bulkLevyDueDate} onChange={(e) => setBulkLevyDueDate(e.target.value)} />
              </div>
            </div>
            {unitsQuery.data && (
              <p className="text-sm text-muted-foreground">
                This will create {unitsQuery.data.length} levies — one per unit.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkLevyOpen(false); resetBulkLevyForm(); }} disabled={bulkCreateMutation.isPending}>Cancel</Button>
            <Button
              onClick={handleBulkCreate}
              disabled={!bulkLevyAmount || !bulkLevyQuarterStart || !bulkLevyDueDate || bulkCreateMutation.isPending}
            >
              {bulkCreateMutation.isPending ? "Raising..." : "Raise Levies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meeting Dialog */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Meeting</DialogTitle>
            <DialogDescription>
              Record a strata committee or general meeting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mtTitle">Title *</Label>
              <Input
                id="mtTitle"
                placeholder="e.g. Annual General Meeting"
                value={formMeetingTitle}
                onChange={(e) => setFormMeetingTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mtDate">Date *</Label>
                <Input
                  id="mtDate"
                  type="date"
                  value={formMeetingDate}
                  onChange={(e) => setFormMeetingDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mtLocation">Location</Label>
                <Input
                  id="mtLocation"
                  placeholder="e.g. Common Room"
                  value={formMeetingLocation}
                  onChange={(e) => setFormMeetingLocation(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtNotes">Notes</Label>
              <Textarea
                id="mtNotes"
                rows={3}
                value={formMeetingNotes}
                onChange={(e) => setFormMeetingNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMeetingOpen(false);
                resetMeetingForm();
              }}
              disabled={createMeetingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMeeting}
              disabled={
                !formMeetingTitle.trim() ||
                !formMeetingDate ||
                createMeetingMutation.isPending
              }
            >
              {createMeetingMutation.isPending ? "Adding..." : "Add Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Bylaw Dialog */}
      <Dialog
        open={bylawOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingBylaw(null);
            resetBylawForm();
          }
          setBylawOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBylaw ? "Edit Bylaw" : "Add Bylaw"}</DialogTitle>
            <DialogDescription>
              {editingBylaw ? "Update this bylaw's details" : "Record a new bylaw for this strata plan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bylawNo">Bylaw Number *</Label>
                <Input
                  id="bylawNo"
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  value={formBylawNumber}
                  onChange={(e) => setFormBylawNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bylawDate">Effective Date *</Label>
                <Input
                  id="bylawDate"
                  type="date"
                  value={formBylawEffectiveDate}
                  onChange={(e) => setFormBylawEffectiveDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bylawTitle">Title *</Label>
              <Input
                id="bylawTitle"
                placeholder="e.g. Noise restrictions"
                value={formBylawTitle}
                onChange={(e) => setFormBylawTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bylawContent">Content *</Label>
              <Textarea
                id="bylawContent"
                rows={5}
                placeholder="Full text of the bylaw..."
                value={formBylawContent}
                onChange={(e) => setFormBylawContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingBylaw(null);
                resetBylawForm();
                setBylawOpen(false);
              }}
              disabled={createBylawMutation.isPending || updateBylawMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBylaw}
              disabled={
                !formBylawNumber ||
                !formBylawTitle.trim() ||
                !formBylawContent.trim() ||
                !formBylawEffectiveDate ||
                createBylawMutation.isPending ||
                updateBylawMutation.isPending
              }
            >
              {createBylawMutation.isPending || updateBylawMutation.isPending
                ? "Saving..."
                : editingBylaw
                ? "Save Changes"
                : "Add Bylaw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
