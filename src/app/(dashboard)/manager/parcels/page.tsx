"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Search, Package, MoreHorizontal } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parcels</h1>
          <p className="text-muted-foreground">
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
          <DialogTrigger render={<Button disabled={!selectedBuildingId} />}>
            <Plus className="mr-2 h-4 w-4" />
            Log Parcel
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Parcel</DialogTitle>
              <DialogDescription>
                Record a new parcel received at the building
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="parcelUnit">Unit Number *</Label>
                <Input
                  id="parcelUnit"
                  placeholder="e.g. 302"
                  value={formUnitNumber}
                  onChange={(e) => setFormUnitNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Name *</Label>
                <Input
                  id="recipient"
                  placeholder="Resident's full name"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  placeholder="e.g. Australia Post, DHL"
                  value={formCarrier}
                  onChange={(e) => setFormCarrier(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input
                  id="tracking"
                  placeholder="Optional"
                  value={formTracking}
                  onChange={(e) => setFormTracking(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="storage">Storage Location</Label>
                <Input
                  id="storage"
                  placeholder="e.g. Shelf A3, Locker 12"
                  value={formStorage}
                  onChange={(e) => setFormStorage(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="parcelNotes">Notes</Label>
                <Textarea
                  id="parcelNotes"
                  placeholder="e.g. Fragile, large item..."
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
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
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
                className="pl-9"
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
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" disabled={parcel.status === "COLLECTED" || parcel.status === "RETURNED"} />}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Collected</DialogTitle>
            <DialogDescription>
              {collectDialogParcel && (
                <>
                  Unit {collectDialogParcel.unitNumber} —{" "}
                  {collectDialogParcel.recipientName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collectedBy">Collected By *</Label>
              <Input
                id="collectedBy"
                placeholder="Name of person collecting"
                value={collectedByName}
                onChange={(e) => setCollectedByName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCollect()}
              />
            </div>
          </div>
          <DialogFooter>
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
