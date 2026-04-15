"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { CalendarDays, Clock, LogIn, LogOut, Plus, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from "sonner";

const PURPOSE_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  DELIVERY: "Delivery",
  TRADESPERSON: "Tradesperson",
  REAL_ESTATE: "Real Estate",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

const PURPOSE_STYLES: Record<string, string> = {
  PERSONAL: "bg-blue-100 text-blue-800",
  DELIVERY: "bg-amber-100 text-amber-800",
  TRADESPERSON: "bg-orange-100 text-orange-800",
  REAL_ESTATE: "bg-purple-100 text-purple-800",
  INSPECTION: "bg-indigo-100 text-indigo-800",
  OTHER: "bg-gray-100 text-gray-700",
};

const PURPOSES = Object.entries(PURPOSE_LABELS) as [string, string][];

function formatTime(date: Date | string | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function VisitorsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPurpose, setFormPurpose] = useState<string>("PERSONAL");
  const [formUnit, setFormUnit] = useState("");
  const [formPreApproved, setFormPreApproved] = useState<string>("false");
  const [formVehiclePlate, setFormVehiclePlate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.visitors.listByBuilding.useQuery(
    selectedBuildingId
      ? { buildingId: selectedBuildingId, date: dateFilter || undefined }
      : skipToken,
    { placeholderData: (prev) => prev }
  );

  const createMutation = trpc.visitors.create.useMutation({
    onSuccess: () => {
      utils.visitors.listByBuilding.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Visitor logged");
    },
    onError: (err) => toast.error(err.message ?? "Failed to log visitor"),
  });

  const logArrivalMutation = trpc.visitors.logArrival.useMutation({
    onSuccess: () => {
      utils.visitors.listByBuilding.invalidate();
      toast.success("Arrival logged");
    },
    onError: (err) => toast.error(err.message ?? "Failed to log arrival"),
  });

  const logDepartureMutation = trpc.visitors.logDeparture.useMutation({
    onSuccess: () => {
      utils.visitors.listByBuilding.invalidate();
      toast.success("Departure logged");
    },
    onError: (err) => toast.error(err.message ?? "Failed to log departure"),
  });

  function resetForm() {
    setFormName("");
    setFormPhone("");
    setFormCompany("");
    setFormPurpose("PERSONAL");
    setFormUnit("");
    setFormPreApproved("false");
    setFormVehiclePlate("");
    setFormNotes("");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formName.trim()) return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      visitorName: formName.trim(),
      visitorPhone: formPhone.trim() || undefined,
      visitorCompany: formCompany.trim() || undefined,
      purpose: formPurpose as Parameters<typeof createMutation.mutate>[0]["purpose"],
      unitToVisit: formUnit.trim() || undefined,
      preApproved: formPreApproved === "true",
      vehiclePlate: formVehiclePlate.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
  }

  const visitors = query.data ?? [];
  const presentCount = visitors.filter(
    (v) => v.arrivalTime && !v.departureTime
  ).length;
  const expectedCount = visitors.filter((v) => !v.arrivalTime).length;
  const departedCount = visitors.filter((v) => !!v.departureTime).length;

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Visitor access log
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Keep a live record of expected guests, arrivals, and departures so front-desk activity stays organised.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Today&apos;s flow</p>
            <div className="mt-4 space-y-3">
              <VisitorSignal icon={Clock} label="Expected" value={`${expectedCount}`} tone="text-blue-600" />
              <VisitorSignal icon={LogIn} label="Present" value={`${presentCount}`} tone="text-emerald-600" />
              <VisitorSignal icon={LogOut} label="Departed" value={`${departedCount}`} tone="text-slate-500" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Visitor register</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Log and track visitor access to the building
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button disabled={!selectedBuildingId} className="h-11 rounded-xl px-5" />}>
            <Plus className="mr-2 h-4 w-4" />
            Log Visitor
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">Log Visitor</DialogTitle>
              <DialogDescription className="px-6">
                Register a visitor for this building
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6">
              <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="visitorName">Visitor Name *</Label>
                    <Input
                      id="visitorName"
                      className="h-11 rounded-xl bg-background"
                      placeholder="Full name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visitorPhone">Phone</Label>
                    <Input
                      id="visitorPhone"
                      className="h-11 rounded-xl bg-background"
                      placeholder="04XX XXX XXX"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visitorCompany">Company</Label>
                    <Input
                      id="visitorCompany"
                      className="h-11 rounded-xl bg-background"
                      placeholder="Company name"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitToVisit">Unit to Visit</Label>
                    <Input
                      id="unitToVisit"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. 302"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehiclePlate">Vehicle Plate</Label>
                    <Input
                      id="vehiclePlate"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. ABC123"
                      value={formVehiclePlate}
                      onChange={(e) => setFormVehiclePlate(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="visitorNotes">Notes</Label>
                    <Textarea
                      id="visitorNotes"
                      className="min-h-24 rounded-xl bg-background"
                      placeholder="Additional instructions or notes..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Access details
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Capture why the visitor is here and whether the visit was approved ahead of arrival.
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Purpose</Label>
                      <Select value={formPurpose} onValueChange={(v) => v !== null && setFormPurpose(v)} itemToStringLabel={(v) => PURPOSES.find(([val]) => val === v)?.[1] ?? String(v)}>
                        <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PURPOSES.map(([value, label]) => (
                            <SelectItem key={value} value={value} label={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pre-Approved?</Label>
                      <Select
                        value={formPreApproved}
                        onValueChange={(v) => v !== null && setFormPreApproved(v)}
                        itemToStringLabel={(v) => v === "true" ? "Yes" : "No"}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false" label="No">No</SelectItem>
                          <SelectItem value="true" label="Yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Front desk tip
                      </div>
                      <p className="mt-2 leading-6">
                        Pre-approved visitors can be processed faster, while detailed notes help staff handle deliveries and contractor access smoothly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="px-6">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Logging..." : "Log Visitor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view visitors.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Date filter + summary */}
          <div className="app-grid-panel flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="dateFilter" className="shrink-0 text-sm font-medium">
                Date
              </Label>
              <Input
                id="dateFilter"
                type="date"
                className="h-11 w-44 rounded-xl bg-background"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateFilter(todayISO())}
              >
                Today
              </Button>
            </div>

            {!query.isLoading && (
              <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1 rounded-full bg-background px-3 py-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                  <strong className="text-foreground">{expectedCount}</strong>{" "}
                  expected
                </span>
                <span className="flex items-center gap-1 rounded-full bg-background px-3 py-1.5">
                  <UserRoundCheck className="h-3.5 w-3.5 text-green-500" />
                  <strong className="text-foreground">{presentCount}</strong>{" "}
                  present
                </span>
                <span className="flex items-center gap-1 rounded-full bg-background px-3 py-1.5">
                  <LogOut className="h-3.5 w-3.5 text-gray-400" />
                  <strong className="text-foreground">{departedCount}</strong>{" "}
                  departed
                </span>
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Pre-Approved</TableHead>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered By</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : visitors.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No visitors logged for this date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visitors.map((visitor) => {
                      const arrived = !!visitor.arrivalTime;
                      const departed = !!visitor.departureTime;

                      return (
                        <TableRow key={visitor.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <p className="font-medium">{visitor.visitorName}</p>
                              {visitor.visitorCompany && (
                                <p className="text-xs text-muted-foreground">
                                  {visitor.visitorCompany}
                                </p>
                              )}
                              {visitor.visitorPhone && (
                                <p className="text-xs text-muted-foreground">
                                  {visitor.visitorPhone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                PURPOSE_STYLES[visitor.purpose] ??
                                "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {PURPOSE_LABELS[visitor.purpose] ?? visitor.purpose}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {visitor.unitToVisit ?? "—"}
                          </TableCell>
                          <TableCell>
                            {visitor.preApproved ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                Yes
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTime(visitor.arrivalTime) ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTime(visitor.departureTime) ?? "—"}
                          </TableCell>
                          <TableCell>
                            {departed ? (
                              <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                Departed
                              </span>
                            ) : arrived ? (
                              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                Present
                              </span>
                            ) : (
                              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                Expected
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {visitor.registeredBy.firstName}{" "}
                            {visitor.registeredBy.lastName}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {!arrived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Log arrival for ${visitor.visitorName}`}
                                  className="h-7 px-2 text-xs"
                                  disabled={logArrivalMutation.isPending}
                                  onClick={() =>
                                    logArrivalMutation.mutate({
                                      id: visitor.id,
                                    })
                                  }
                                >
                                  <LogIn className="mr-1 h-3 w-3" />
                                  Arrive
                                </Button>
                              )}
                              {arrived && !departed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Log departure for ${visitor.visitorName}`}
                                  className="h-7 px-2 text-xs"
                                  disabled={logDepartureMutation.isPending}
                                  onClick={() =>
                                    logDepartureMutation.mutate({
                                      id: visitor.id,
                                    })
                                  }
                                >
                                  <LogOut className="mr-1 h-3 w-3" />
                                  Depart
                                </Button>
                              )}
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
        </>
      )}
    </div>
  );
}

function VisitorSignal({
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
