"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Archive, BellRing, Boxes, MoreHorizontal, Package, Plus, Search } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";

type TabValue = "pending" | "all" | "collected" | "returned";

const PENDING_STATUSES = ["RECEIVED", "NOTIFIED"];

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  NOTIFIED: "bg-yellow-100 text-yellow-800",
  COLLECTED: "bg-green-100 text-green-800",
  RETURNED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  NOTIFIED: "Notified",
  COLLECTED: "Collected",
  RETURNED: "Returned",
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ParcelsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState<TabValue>("pending");
  const [search, setSearch] = useState("");

  // Log Parcel dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [formUnitNumber, setFormUnitNumber] = useState("");
  const [formRecipient, setFormRecipient] = useState("");
  const [formCarrier, setFormCarrier] = useState("");
  const [formTracking, setFormTracking] = useState("");
  const [formStorage, setFormStorage] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Mark Collected dialog
  const [collectDialogParcel, setCollectDialogParcel] = useState<{
    id: string;
    recipientName: string;
    unitNumber: string;
  } | null>(null);
  const [collectedByName, setCollectedByName] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.parcels.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const createMutation = trpc.parcels.create.useMutation({
    onSuccess: () => {
      utils.parcels.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Parcel logged");
    },
    onError: (err) => toast.error(err.message ?? "Failed to log parcel"),
  });

  const notifyMutation = trpc.parcels.markNotified.useMutation({
    onSuccess: () => {
      utils.parcels.listByBuilding.invalidate();
      toast.success("Resident notified");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update parcel"),
  });

  const collectMutation = trpc.parcels.markCollected.useMutation({
    onSuccess: () => {
      utils.parcels.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setCollectDialogParcel(null);
      setCollectedByName("");
      toast.success("Parcel marked as collected");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update parcel"),
  });

  const returnMutation = trpc.parcels.markReturned.useMutation({
    onSuccess: () => {
      utils.parcels.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      toast.success("Parcel marked as returned");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update parcel"),
  });

  function resetCreateForm() {
    setFormUnitNumber("");
    setFormRecipient("");
    setFormCarrier("");
    setFormTracking("");
    setFormStorage("");
    setFormNotes("");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formUnitNumber.trim() || !formRecipient.trim())
      return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      unitNumber: formUnitNumber.trim(),
      recipientName: formRecipient.trim(),
      carrier: formCarrier.trim() || undefined,
      trackingNumber: formTracking.trim() || undefined,
      storageLocation: formStorage.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
  }

  function handleCollect() {
    if (!collectDialogParcel || !collectedByName.trim()) return;
    collectMutation.mutate({
      id: collectDialogParcel.id,
      collectedBy: collectedByName.trim(),
    });
  }

  const allParcels = query.data ?? [];

  const filtered = allParcels
    .filter((p) => {
      if (tab === "pending") return PENDING_STATUSES.includes(p.status);
      if (tab === "collected") return p.status === "COLLECTED";
      if (tab === "returned") return p.status === "RETURNED";
      return true;
    })
    .filter(
      (p) =>
        !search ||
        p.recipientName.toLowerCase().includes(search.toLowerCase()) ||
        p.unitNumber.includes(search) ||
        (p.trackingNumber ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const pendingCount = allParcels.filter((p) =>
    PENDING_STATUSES.includes(p.status)
  ).length;
  const collectedCount = allParcels.filter(
    (p) => p.status === "COLLECTED"
  ).length;
  const returnedCount = allParcels.filter(
    (p) => p.status === "RETURNED"
  ).length;

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Parcel handling and collection
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Keep delivery handling visible for staff, notify residents promptly, and maintain a clean handover history.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Parcel flow</p>
            <div className="mt-4 space-y-3">
              <ParcelSignal icon={Boxes} label="Pending" value={`${pendingCount}`} tone="text-blue-600" />
              <ParcelSignal icon={BellRing} label="Collected" value={`${collectedCount}`} tone="text-emerald-600" />
              <ParcelSignal icon={Archive} label="Returned" value={`${returnedCount}`} tone="text-slate-500" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Parcel register</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track parcel deliveries for residents
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger render={<Button disabled={!selectedBuildingId} className="h-11 rounded-xl px-5" />}>
            <Plus className="mr-2 h-4 w-4" />
            Log Parcel
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">Log Parcel</DialogTitle>
              <DialogDescription className="px-6">
                Record a new parcel received at the building
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6">
              <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parcelUnit">Unit Number *</Label>
                    <Input
                      id="parcelUnit"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. 302"
                      value={formUnitNumber}
                      onChange={(e) => setFormUnitNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient">Recipient Name *</Label>
                    <Input
                      id="recipient"
                      className="h-11 rounded-xl bg-background"
                      placeholder="Resident's full name"
                      value={formRecipient}
                      onChange={(e) => setFormRecipient(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrier">Carrier</Label>
                    <Input
                      id="carrier"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. Australia Post, DHL"
                      value={formCarrier}
                      onChange={(e) => setFormCarrier(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tracking">Tracking Number</Label>
                    <Input
                      id="tracking"
                      className="h-11 rounded-xl bg-background"
                      placeholder="Optional"
                      value={formTracking}
                      onChange={(e) => setFormTracking(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="storage">Storage Location</Label>
                    <Input
                      id="storage"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. Shelf A3, Locker 12"
                      value={formStorage}
                      onChange={(e) => setFormStorage(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="parcelNotes">Notes</Label>
                    <Textarea
                      id="parcelNotes"
                      className="min-h-24 rounded-xl bg-background"
                      placeholder="e.g. Fragile, large item..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Handling notes
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Record enough detail so any team member can notify the resident and complete collection without confusion.
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Package className="h-4 w-4 text-primary" />
                      Good practice
                    </div>
                    <p className="mt-2 leading-6">
                      Include the carrier, exact storage location, and any special handling note for oversized or fragile deliveries.
                    </p>
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
                disabled={
                  !formUnitNumber.trim() ||
                  !formRecipient.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Logging..." : "Log Parcel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view parcels.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <div className="app-grid-panel flex flex-wrap items-center gap-3 p-4">
            <TabsList className="bg-background/80">
              <TabsTrigger value="pending">
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="all">All ({allParcels.length})</TabsTrigger>
              <TabsTrigger value="collected">
                Collected ({collectedCount})
              </TabsTrigger>
              <TabsTrigger value="returned">
                Returned ({returnedCount})
              </TabsTrigger>
            </TabsList>

            <div className="relative ml-auto w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search unit, name, tracking..."
                className="h-11 rounded-xl bg-background pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Logged</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
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
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="py-12 text-center text-muted-foreground"
                        >
                          {tab === "pending"
                            ? "No pending parcels — all caught up!"
                            : "No parcels found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((parcel) => (
                        <TableRow key={parcel.id} className="hover:bg-muted/50">
                          <TableCell className="font-semibold">
                            {parcel.unitNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{parcel.recipientName}</p>
                              <p className="text-xs text-muted-foreground">
                                Logged by {parcel.loggedBy.firstName}{" "}
                                {parcel.loggedBy.lastName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {parcel.carrier ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {parcel.trackingNumber ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {parcel.storageLocation ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(parcel.loggedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {parcel.collectedAt ? (
                              <span>
                                {formatDate(parcel.collectedAt)}
                                {parcel.collectedBy && (
                                  <span className="block text-xs">
                                    by {parcel.collectedBy}
                                  </span>
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                STATUS_STYLES[parcel.status] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {STATUS_LABELS[parcel.status] ?? parcel.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Open actions for parcel ${parcel.recipientName}`} className="h-8 w-8" disabled={parcel.status === "COLLECTED" || parcel.status === "RETURNED"} />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {parcel.status === "RECEIVED" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      notifyMutation.mutate({ id: parcel.id })
                                    }
                                  >
                                    Notify Resident
                                  </DropdownMenuItem>
                                )}
                                {(parcel.status === "RECEIVED" ||
                                  parcel.status === "NOTIFIED") && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setCollectDialogParcel({
                                        id: parcel.id,
                                        recipientName: parcel.recipientName,
                                        unitNumber: parcel.unitNumber,
                                      });
                                      setCollectedByName("");
                                    }}
                                  >
                                    Mark Collected
                                  </DropdownMenuItem>
                                )}
                                {(parcel.status === "RECEIVED" ||
                                  parcel.status === "NOTIFIED") && (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() =>
                                      returnMutation.mutate({ id: parcel.id })
                                    }
                                  >
                                    Mark Returned
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      )}

      {/* Mark Collected dialog */}
      <Dialog
        open={!!collectDialogParcel}
        onOpenChange={(open) => {
          if (!open) {
            setCollectDialogParcel(null);
            setCollectedByName("");
          }
        }}
      >
        <DialogContent className="max-w-lg p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Mark as Collected</DialogTitle>
            <DialogDescription className="px-6">
              {collectDialogParcel && (
                <>
                  Unit {collectDialogParcel.unitNumber} —{" "}
                  {collectDialogParcel.recipientName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="collectedBy">Collected By *</Label>
              <Input
                id="collectedBy"
                className="h-11 rounded-xl bg-background"
                placeholder="Name of person collecting"
                value={collectedByName}
                onChange={(e) => setCollectedByName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCollect()}
              />
            </div>
          </div>
          <DialogFooter className="px-6">
            <Button
              variant="outline"
              onClick={() => {
                setCollectDialogParcel(null);
                setCollectedByName("");
              }}
              disabled={collectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCollect}
              disabled={
                !collectedByName.trim() || collectMutation.isPending
              }
            >
              {collectMutation.isPending ? "Saving..." : "Confirm Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParcelSignal({
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
