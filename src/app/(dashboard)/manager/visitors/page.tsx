"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Clock, LogIn, LogOut } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitors</h1>
          <p className="text-muted-foreground">
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
          <DialogTrigger asChild>
            <Button disabled={!selectedBuildingId}>
              <Plus className="mr-2 h-4 w-4" />
              Log Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log Visitor</DialogTitle>
              <DialogDescription>
                Register a visitor for this building
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="visitorName">Visitor Name *</Label>
                <Input
                  id="visitorName"
                  placeholder="Full name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitorPhone">Phone</Label>
                <Input
                  id="visitorPhone"
                  placeholder="04XX XXX XXX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitorCompany">Company</Label>
                <Input
                  id="visitorCompany"
                  placeholder="Company name"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select value={formPurpose} onValueChange={setFormPurpose}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitToVisit">Unit to Visit</Label>
                <Input
                  id="unitToVisit"
                  placeholder="e.g. 302"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pre-Approved?</Label>
                <Select
                  value={formPreApproved}
                  onValueChange={setFormPreApproved}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehiclePlate">Vehicle Plate</Label>
                <Input
                  id="vehiclePlate"
                  placeholder="e.g. ABC123"
                  value={formVehiclePlate}
                  onChange={(e) => setFormVehiclePlate(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="visitorNotes">Notes</Label>
                <Textarea
                  id="visitorNotes"
                  placeholder="Additional instructions or notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="dateFilter" className="shrink-0 text-sm">
                Date
              </Label>
              <Input
                id="dateFilter"
                type="date"
                className="w-44"
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
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <strong className="text-foreground">{expectedCount}</strong>{" "}
                  expected
                </span>
                <span className="flex items-center gap-1">
                  <LogIn className="h-3.5 w-3.5 text-green-500" />
                  <strong className="text-foreground">{presentCount}</strong>{" "}
                  present
                </span>
                <span className="flex items-center gap-1">
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
