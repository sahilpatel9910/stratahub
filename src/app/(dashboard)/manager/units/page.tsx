"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Bath, BedDouble, Building2, DoorOpen, Home, Plus, Search, SquareMenu, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { isTenancySetupPending } from "@/lib/tenancies";
import { toast } from "sonner";

type OccupancyFilter = "all" | "occupied" | "vacant";
type ResidentAssignmentRole = "OWNER" | "TENANT";
type RentFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

const UNIT_TYPES = Object.entries(UNIT_TYPE_LABELS) as [
  keyof typeof UNIT_TYPE_LABELS,
  string,
][];

export default function UnitsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<OccupancyFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formUnitNumber, setFormUnitNumber] = useState("");
  const [formUnitType, setFormUnitType] =
    useState<keyof typeof UNIT_TYPE_LABELS>("APARTMENT");
  const [formBedrooms, setFormBedrooms] = useState("");
  const [formBathrooms, setFormBathrooms] = useState("");
  const [formSize, setFormSize] = useState("");
  const [formParking, setFormParking] = useState("0");
  const [formStorage, setFormStorage] = useState("0");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState("");
  const [assignRole, setAssignRole] = useState<ResidentAssignmentRole>("OWNER");
  const [assignResidentUserId, setAssignResidentUserId] = useState("");
  const [assignPurchaseDate, setAssignPurchaseDate] = useState("");
  const [assignLeaseStartDate, setAssignLeaseStartDate] = useState("");
  const [assignLeaseEndDate, setAssignLeaseEndDate] = useState("");
  const [assignRentAmount, setAssignRentAmount] = useState("");
  const [assignRentFrequency, setAssignRentFrequency] = useState<RentFrequency>("MONTHLY");
  const [assignBondAmount, setAssignBondAmount] = useState("");
  const [assignMoveInDate, setAssignMoveInDate] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const residentsQuery = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const createMutation = trpc.units.create.useMutation({
    onSuccess: (result) => {
      utils.units.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setDialogOpen(false);
      resetForm();
      toast.success(
        result.ownerStatus === "linked"
          ? "Unit created and owner linked"
          : "Unit created and owner invite sent"
      );
    },
    onError: (err) => toast.error(err.message ?? "Failed to create unit"),
  });

  const assignResidentMutation = trpc.units.assignResident.useMutation({
    onSuccess: () => {
      utils.units.listByBuilding.invalidate();
      utils.residents.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setAssignDialogOpen(false);
      resetAssignForm();
      toast.success("Unit resident updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to assign resident"),
  });

  function resetForm() {
    setFormUnitNumber("");
    setFormUnitType("APARTMENT");
    setFormBedrooms("");
    setFormBathrooms("");
    setFormSize("");
    setFormParking("0");
    setFormStorage("0");
    setOwnerFirstName("");
    setOwnerLastName("");
    setOwnerEmail("");
    setOwnerPhone("");
  }

  function resetAssignForm() {
    setAssignUnitId("");
    setAssignRole("OWNER");
    setAssignResidentUserId("");
    setAssignPurchaseDate("");
    setAssignLeaseStartDate("");
    setAssignLeaseEndDate("");
    setAssignRentAmount("");
    setAssignRentFrequency("MONTHLY");
    setAssignBondAmount("");
    setAssignMoveInDate("");
  }

  function handleCreate() {
    if (
      !selectedBuildingId ||
      !formUnitNumber.trim() ||
      !ownerFirstName.trim() ||
      !ownerLastName.trim() ||
      !ownerEmail.trim() ||
      !ownerPhone.trim()
    ) return;

    createMutation.mutate({
      buildingId: selectedBuildingId,
      unitNumber: formUnitNumber.trim(),
      unitType: formUnitType,
      bedrooms: formBedrooms ? parseInt(formBedrooms) : undefined,
      bathrooms: formBathrooms ? parseInt(formBathrooms) : undefined,
      squareMetres: formSize ? parseFloat(formSize) : undefined,
      parkingSpaces: parseInt(formParking) || 0,
      storageSpaces: parseInt(formStorage) || 0,
      ownerFirstName: ownerFirstName.trim(),
      ownerLastName: ownerLastName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      ownerPhone: ownerPhone.trim(),
    });
  }

  function handleAssignResident() {
    if (!assignUnitId || !assignResidentUserId) return;

    assignResidentMutation.mutate({
      unitId: assignUnitId,
      residentUserId: assignResidentUserId,
      role: assignRole,
      purchaseDate: assignPurchaseDate ? new Date(assignPurchaseDate) : undefined,
      leaseStartDate: assignLeaseStartDate ? new Date(assignLeaseStartDate) : undefined,
      leaseEndDate: assignLeaseEndDate ? new Date(assignLeaseEndDate) : undefined,
      rentAmountCents: assignRentAmount ? Math.round(parseFloat(assignRentAmount) * 100) : undefined,
      rentFrequency: assignRentFrequency,
      bondAmountCents: assignBondAmount ? Math.round(parseFloat(assignBondAmount) * 100) : undefined,
      moveInDate: assignMoveInDate ? new Date(assignMoveInDate) : undefined,
    });
  }

  const allUnits = query.data ?? [];
  const allResidents = residentsQuery.data ?? [];
  const assignableResidents = allResidents.filter((resident) =>
    resident.buildingRole === assignRole
  );

  const filtered = allUnits
    .filter((u) => {
      if (tab === "occupied") return u.isOccupied;
      if (tab === "vacant") return !u.isOccupied;
      return true;
    })
    .filter((u) =>
      u.unitNumber.toLowerCase().includes(search.toLowerCase())
    );

  const occupiedCount = allUnits.filter((u) => u.isOccupied).length;
  const vacantCount = allUnits.filter((u) => !u.isOccupied).length;

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Unit inventory and occupancy
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Keep the building&apos;s units organised, monitor occupancy, and maintain the core details staff rely on every day.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Unit status</p>
            <div className="mt-4 space-y-3">
              <UnitSignal icon={Building2} label="All units" value={`${allUnits.length}`} tone="text-slate-600" />
              <UnitSignal icon={Home} label="Occupied" value={`${occupiedCount}`} tone="text-blue-600" />
              <UnitSignal icon={DoorOpen} label="Vacant" value={`${vacantCount}`} tone="text-emerald-600" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Units register</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all units in this building
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button disabled={!selectedBuildingId} className="h-11 rounded-xl px-5" />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">Add Unit</DialogTitle>
              <DialogDescription className="px-6">
                Create a new unit in this building
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6">
              <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.9fr)]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="unitNumber">Unit Number *</Label>
                    <Input
                      id="unitNumber"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. 101, PH1"
                      value={formUnitNumber}
                      onChange={(e) => setFormUnitNumber(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Unit Type</Label>
                    <Select
                      value={formUnitType}
                      onValueChange={(v) =>
                        setFormUnitType(v as keyof typeof UNIT_TYPE_LABELS)
                      }
                      itemToStringLabel={(v) => UNIT_TYPES.find(([val]) => val === v)?.[1] ?? String(v)}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value} label={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      min="0"
                      className="h-11 rounded-xl bg-background"
                      placeholder="0"
                      value={formBedrooms}
                      onChange={(e) => setFormBedrooms(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      min="0"
                      className="h-11 rounded-xl bg-background"
                      placeholder="0"
                      value={formBathrooms}
                      onChange={(e) => setFormBathrooms(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Size (m²)</Label>
                    <Input
                      id="size"
                      type="number"
                      min="0"
                      step="0.1"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. 85.5"
                      value={formSize}
                      onChange={(e) => setFormSize(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parking">Parking Spaces</Label>
                    <Input
                      id="parking"
                      type="number"
                      min="0"
                      className="h-11 rounded-xl bg-background"
                      value={formParking}
                      onChange={(e) => setFormParking(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storage">Storage Spaces</Label>
                    <Input
                      id="storage"
                      type="number"
                      min="0"
                      className="h-11 rounded-xl bg-background"
                      value={formStorage}
                      onChange={(e) => setFormStorage(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 mt-3 border-t border-border/70 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Mandatory owner details
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Every new unit must start with an owner record. If the owner already has an account, they will be linked immediately. Otherwise, StrataHub sends them an owner invite for this unit.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerFirstName">Owner First Name *</Label>
                    <Input
                      id="ownerFirstName"
                      className="h-11 rounded-xl bg-background"
                      value={ownerFirstName}
                      onChange={(e) => setOwnerFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerLastName">Owner Last Name *</Label>
                    <Input
                      id="ownerLastName"
                      className="h-11 rounded-xl bg-background"
                      value={ownerLastName}
                      onChange={(e) => setOwnerLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerEmail">Owner Email *</Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      className="h-11 rounded-xl bg-background"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerPhone">Owner Phone *</Label>
                    <Input
                      id="ownerPhone"
                      className="h-11 rounded-xl bg-background"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Planning details
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Capture the layout, ownership, and capacity basics now so occupancy, parking, storage, maintenance, and resident assignment screens stay accurate later.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="px-6">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !formUnitNumber.trim() ||
                  !ownerFirstName.trim() ||
                  !ownerLastName.trim() ||
                  !ownerEmail.trim() ||
                  !ownerPhone.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Unit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view units.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as OccupancyFilter)}>
          <div className="app-grid-panel flex items-center gap-4 p-4">
            <TabsList className="bg-background/80">
              <TabsTrigger value="all">All ({allUnits.length})</TabsTrigger>
              <TabsTrigger value="occupied">
                Occupied ({occupiedCount})
              </TabsTrigger>
              <TabsTrigger value="vacant">Vacant ({vacantCount})</TabsTrigger>
            </TabsList>
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by unit number..."
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
                      <TableHead>Type</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Maintenance</TableHead>
                      <TableHead className="text-right">Assign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-16" />
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
                          {search
                            ? "No units match your search."
                            : "No units found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((unit) => {
                        const owner = unit.ownerships[0]?.user;
                        const tenant = unit.tenancies[0]?.user;
                        const activeTenancy = unit.tenancies[0];
                        const residentName = owner
                          ? `${owner.firstName} ${owner.lastName}`
                          : tenant
                            ? `${tenant.firstName} ${tenant.lastName}`
                            : null;
                        const residentRole = owner
                          ? "Owner"
                          : tenant
                            ? "Tenant"
                            : null;

                        return (
                          <TableRow key={unit.id} className="hover:bg-muted/50">
                            <TableCell className="font-semibold">
                              {unit.unitNumber}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {UNIT_TYPE_LABELS[unit.unitType as keyof typeof UNIT_TYPE_LABELS] ?? unit.unitType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {unit.floor
                                ? `Floor ${unit.floor.number}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                {unit.bedrooms != null && (
                                  <span className="flex items-center gap-1">
                                    <BedDouble className="h-3 w-3" />
                                    {unit.bedrooms}
                                  </span>
                                )}
                                {unit.bathrooms != null && (
                                  <span className="flex items-center gap-1">
                                    <Bath className="h-3 w-3" />
                                    {unit.bathrooms}
                                  </span>
                                )}
                                {!unit.bedrooms && !unit.bathrooms && "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {unit.squareMetres != null ? (
                                <span className="flex items-center gap-1 text-sm">
                                  <SquareMenu className="h-3 w-3" />
                                  {unit.squareMetres}m²
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  unit.isOccupied ? "default" : "secondary"
                                }
                                className={
                                  unit.isOccupied
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : ""
                                }
                              >
                                {unit.isOccupied ? "Occupied" : "Vacant"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {residentName ? (
                                <div>
                                  <p className="text-sm font-medium">
                                    {residentName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {residentRole}
                                  </p>
                                  {activeTenancy && isTenancySetupPending(activeTenancy) && (
                                    <Badge variant="outline" className="mt-1 border-sky-200 bg-sky-50 text-[10px] text-sky-700">
                                      Tenant setup needed
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {unit._count.maintenanceReqs > 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  {unit._count.maintenanceReqs} open
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-lg"
                                onClick={() => {
                                  resetAssignForm();
                                  setAssignUnitId(unit.id);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) resetAssignForm();
        }}
      >
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Assign resident to unit</DialogTitle>
            <DialogDescription className="px-6">
              Link an existing owner or tenant to this unit. Owner assignment marks the owner as the active occupier. Tenant assignment requires lease details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Resident Type</Label>
              <Select
                value={assignRole}
                onValueChange={(value) => {
                  setAssignRole(value as ResidentAssignmentRole);
                  setAssignResidentUserId("");
                }}
                itemToStringLabel={(value) => (value === "OWNER" ? "Owner" : "Tenant")}
              >
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER" label="Owner">
                    Owner
                  </SelectItem>
                  <SelectItem value="TENANT" label="Tenant">
                    Tenant
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resident</Label>
              <Select
                value={assignResidentUserId}
                onValueChange={(value) => {
                  if (value !== null) setAssignResidentUserId(value);
                }}
                itemToStringLabel={(value) => {
                  const resident = assignableResidents.find((entry) => entry.id === value);
                  return resident ? `${resident.firstName} ${resident.lastName}` : String(value);
                }}
              >
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                  <SelectValue placeholder={`Select a ${assignRole === "OWNER" ? "owner" : "tenant"}`} />
                </SelectTrigger>
                <SelectContent>
                  {assignableResidents.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No {assignRole === "OWNER" ? "owners" : "tenants"} are available in this building yet.
                    </div>
                  ) : (
                    assignableResidents.map((resident) => (
                      <SelectItem
                        key={resident.id}
                        value={resident.id}
                        label={`${resident.firstName} ${resident.lastName}`}
                      >
                        {resident.firstName} {resident.lastName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {assignRole === "OWNER" ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="purchaseDate">Ownership Start</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  className="h-11 rounded-xl bg-background"
                  value={assignPurchaseDate}
                  onChange={(e) => setAssignPurchaseDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="leaseStartDate">Lease Start *</Label>
                  <Input
                    id="leaseStartDate"
                    type="date"
                    className="h-11 rounded-xl bg-background"
                    value={assignLeaseStartDate}
                    onChange={(e) => setAssignLeaseStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaseEndDate">Lease End</Label>
                  <Input
                    id="leaseEndDate"
                    type="date"
                    className="h-11 rounded-xl bg-background"
                    value={assignLeaseEndDate}
                    onChange={(e) => setAssignLeaseEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentAmount">Rent Amount (AUD) *</Label>
                  <Input
                    id="rentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-11 rounded-xl bg-background"
                    value={assignRentAmount}
                    onChange={(e) => setAssignRentAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rent Frequency *</Label>
                  <Select
                    value={assignRentFrequency}
                    onValueChange={(value) => setAssignRentFrequency(value as RentFrequency)}
                    itemToStringLabel={(value) => value.toLowerCase()}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY" label="Weekly">Weekly</SelectItem>
                      <SelectItem value="FORTNIGHTLY" label="Fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="MONTHLY" label="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bondAmount">Bond Amount (AUD) *</Label>
                  <Input
                    id="bondAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-11 rounded-xl bg-background"
                    value={assignBondAmount}
                    onChange={(e) => setAssignBondAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moveInDate">Move-in Date</Label>
                  <Input
                    id="moveInDate"
                    type="date"
                    className="h-11 rounded-xl bg-background"
                    value={assignMoveInDate}
                    onChange={(e) => setAssignMoveInDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assignResidentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignResident}
              disabled={
                !assignResidentUserId ||
                assignResidentMutation.isPending ||
                (assignRole === "TENANT" &&
                  (!assignLeaseStartDate.trim() ||
                    !assignRentAmount.trim() ||
                    !assignBondAmount.trim()))
              }
            >
              {assignResidentMutation.isPending ? "Saving..." : "Assign Resident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitSignal({
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
