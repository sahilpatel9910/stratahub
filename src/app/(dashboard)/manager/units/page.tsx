"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Search, BedDouble, Bath, SquareMenu } from "lucide-react";
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
import { toast } from "sonner";

type OccupancyFilter = "all" | "occupied" | "vacant";

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

  const utils = trpc.useUtils();

  const query = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const createMutation = trpc.units.create.useMutation({
    onSuccess: () => {
      utils.units.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setDialogOpen(false);
      resetForm();
      toast.success("Unit created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create unit"),
  });

  function resetForm() {
    setFormUnitNumber("");
    setFormUnitType("APARTMENT");
    setFormBedrooms("");
    setFormBathrooms("");
    setFormSize("");
    setFormParking("0");
    setFormStorage("0");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formUnitNumber.trim()) return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      unitNumber: formUnitNumber.trim(),
      unitType: formUnitType,
      bedrooms: formBedrooms ? parseInt(formBedrooms) : undefined,
      bathrooms: formBathrooms ? parseInt(formBathrooms) : undefined,
      squareMetres: formSize ? parseFloat(formSize) : undefined,
      parkingSpaces: parseInt(formParking) || 0,
      storageSpaces: parseInt(formStorage) || 0,
    });
  }

  const allUnits = query.data ?? [];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">
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
          <DialogTrigger render={<Button disabled={!selectedBuildingId} />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Unit</DialogTitle>
              <DialogDescription>
                Create a new unit in this building
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="unitNumber">Unit Number *</Label>
                <Input
                  id="unitNumber"
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
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
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
                  value={formParking}
                  onChange={(e) => setFormParking(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formUnitNumber.trim() || createMutation.isPending}
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
          <div className="flex items-center gap-4">
            <TabsList>
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
                      <TableHead>Type</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Maintenance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
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
                          <TableRow
                            key={unit.id}
                            className="cursor-pointer hover:bg-muted/50"
                          >
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
    </div>
  );
}
