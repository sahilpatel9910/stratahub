"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, DoorOpen, CalendarCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";

type CommonArea = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  floor: number | null;
  operatingHours: string | null;
  bookingRequired: boolean;
  isActive: boolean;
};

const BOOKING_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONFIRMED:  { label: "Confirmed",  variant: "default" },
  CANCELLED:  { label: "Cancelled",  variant: "destructive" },
  COMPLETED:  { label: "Completed",  variant: "secondary" },
};

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommonAreasPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState("facilities");

  // Dialog state
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<CommonArea | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Facility form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formFloor, setFormFloor] = useState("");
  const [formOperatingHours, setFormOperatingHours] = useState("");
  const [formBookingRequired, setFormBookingRequired] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const utils = trpc.useUtils();

  const facilitiesQuery = trpc.commonAreas.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const bookingsQuery = trpc.commonAreas.listBuildingBookings.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.commonAreas.create.useMutation({
    onSuccess: () => {
      utils.commonAreas.listByBuilding.invalidate();
      setFacilityOpen(false);
      resetForm();
      toast.success("Facility created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create facility"),
  });

  const updateMutation = trpc.commonAreas.update.useMutation({
    onSuccess: () => {
      utils.commonAreas.listByBuilding.invalidate();
      setFacilityOpen(false);
      setEditingFacility(null);
      resetForm();
      toast.success("Facility updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update facility"),
  });

  const deleteMutation = trpc.commonAreas.delete.useMutation({
    onSuccess: () => {
      utils.commonAreas.listByBuilding.invalidate();
      setDeletingId(null);
      toast.success("Facility deleted");
    },
    onError: (err) => {
      setDeletingId(null);
      toast.error(err.message ?? "Failed to delete facility");
    },
  });

  const cancelBookingMutation = trpc.commonAreas.cancelBooking.useMutation({
    onSuccess: () => {
      utils.commonAreas.listBuildingBookings.invalidate();
      toast.success("Booking cancelled");
    },
    onError: (err) => toast.error(err.message ?? "Failed to cancel booking"),
  });

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormCapacity("");
    setFormFloor("");
    setFormOperatingHours("");
    setFormBookingRequired(false);
    setFormIsActive(true);
  }

  function openAdd() {
    setEditingFacility(null);
    resetForm();
    setFacilityOpen(true);
  }

  function openEdit(area: CommonArea) {
    setEditingFacility(area);
    setFormName(area.name);
    setFormDescription(area.description ?? "");
    setFormCapacity(area.capacity != null ? String(area.capacity) : "");
    setFormFloor(area.floor != null ? String(area.floor) : "");
    setFormOperatingHours(area.operatingHours ?? "");
    setFormBookingRequired(area.bookingRequired);
    setFormIsActive(area.isActive);
    setFacilityOpen(true);
  }

  const toInt = (s: string) => { const n = parseInt(s, 10); return Number.isNaN(n) ? undefined : n; };

  function handleSave() {
    if (!selectedBuildingId || !formName.trim()) return;

    const capacity = formCapacity ? toInt(formCapacity) : undefined;
    const floor = formFloor ? toInt(formFloor) : undefined;

    if (editingFacility) {
      updateMutation.mutate({
        id: editingFacility.id,
        name: formName.trim(),
        description: formDescription.trim() || null,
        capacity: capacity ?? null,
        floor: floor ?? null,
        operatingHours: formOperatingHours.trim() || null,
        bookingRequired: formBookingRequired,
        isActive: formIsActive,
      });
    } else {
      createMutation.mutate({
        buildingId: selectedBuildingId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        capacity,
        floor,
        operatingHours: formOperatingHours.trim() || undefined,
        bookingRequired: formBookingRequired,
      });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Common Areas</h1>
          <p className="text-muted-foreground">
            Manage shared facilities and resident bookings
          </p>
        </div>
        {tab === "facilities" && (
          <Button onClick={openAdd} disabled={!selectedBuildingId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Facility
          </Button>
        )}
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view common areas.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="facilities">Facilities</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          {/* Facilities Tab */}
          <TabsContent value="facilities" className="mt-4">
            {facilitiesQuery.isLoading ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Name", "Description", "Floor", "Capacity", "Hours", "Booking Required", "Status", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !facilitiesQuery.data?.length ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <DoorOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No facilities have been added yet.</p>
                  <Button className="mt-4" onClick={openAdd}>
                    Add First Facility
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Floor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Capacity</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Operating Hours</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Booking Required</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {facilitiesQuery.data.map((area) => (
                      <tr key={area.id} className="bg-white hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{area.name}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                          {area.description ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {area.floor != null ? `Floor ${area.floor}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {area.capacity != null ? area.capacity : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {area.operatingHours ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {area.bookingRequired ? (
                            <Badge variant="secondary">Required</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {area.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(area)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              disabled={deletingId === area.id}
                              onClick={() => {
                                setDeletingId(area.id);
                                deleteMutation.mutate({ id: area.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="mt-4">
            {bookingsQuery.isLoading ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Facility", "Resident", "Start", "End", "Status", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !bookingsQuery.data?.length ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No bookings have been made yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Facility</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">End</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bookingsQuery.data.map((booking) => {
                      const sc = BOOKING_STATUS_CONFIG[booking.status] ?? BOOKING_STATUS_CONFIG.CONFIRMED;
                      return (
                        <tr key={booking.id} className="bg-white hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{booking.commonArea.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {booking.user.firstName} {booking.user.lastName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(booking.startTime)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(booking.endTime)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {booking.status === "CONFIRMED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={cancelBookingMutation.isPending}
                                onClick={() => cancelBookingMutation.mutate({ id: booking.id })}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add / Edit Facility Dialog */}
      <Dialog
        open={facilityOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFacility(null);
            resetForm();
          }
          setFacilityOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFacility ? "Edit Facility" : "Add Facility"}</DialogTitle>
            <DialogDescription>
              {editingFacility
                ? "Update the details for this common area"
                : "Add a new shared facility to this building"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 px-7 py-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caName">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="caName"
                placeholder="e.g. Rooftop Terrace"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caDesc">Description</Label>
              <Textarea
                id="caDesc"
                rows={3}
                placeholder="Brief description of the facility..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="caCapacity">Capacity</Label>
                <Input
                  id="caCapacity"
                  type="number"
                  min="1"
                  placeholder="e.g. 20"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="caFloor">Floor</Label>
                <Input
                  id="caFloor"
                  type="number"
                  placeholder="e.g. 10"
                  value={formFloor}
                  onChange={(e) => setFormFloor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caHours">Operating Hours</Label>
              <Input
                id="caHours"
                placeholder="e.g. 7am – 10pm daily"
                value={formOperatingHours}
                onChange={(e) => setFormOperatingHours(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="caBookingRequired"
                type="checkbox"
                checked={formBookingRequired}
                onChange={(e) => setFormBookingRequired(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <Label htmlFor="caBookingRequired" className="cursor-pointer">
                Booking required
              </Label>
            </div>
            {editingFacility && (
              <div className="flex items-center gap-2">
                <input
                  id="caIsActive"
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
                <Label htmlFor="caIsActive" className="cursor-pointer">
                  Active (available to residents)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingFacility(null);
                resetForm();
                setFacilityOpen(false);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || isSaving}
            >
              {isSaving
                ? "Saving..."
                : editingFacility
                ? "Save Changes"
                : "Add Facility"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
