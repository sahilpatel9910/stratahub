"use client";

import { useState } from "react";
import { Building2, Plus, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AUSTRALIAN_STATES } from "@/lib/constants";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type AustralianStateValue = (typeof AUSTRALIAN_STATES)[number]["value"];

export default function SuperAdminBuildingsPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [formOrgId, setFormOrgId] = useState("");
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSuburb, setFormSuburb] = useState("");
  const [formState, setFormState] = useState<AustralianStateValue | "">("");
  const [formPostcode, setFormPostcode] = useState("");
  const [formFloors, setFormFloors] = useState("");
  const [formUnits, setFormUnits] = useState("");
  const [formStrataNo, setFormStrataNo] = useState("");

  const utils = trpc.useUtils();

  const buildingsQuery = trpc.buildings.list.useQuery({});
  const orgsQuery = trpc.organisations.list.useQuery();

  const createMutation = trpc.buildings.create.useMutation({
    onSuccess: () => {
      utils.buildings.list.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Building created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create building"),
  });

  const deleteMutation = trpc.buildings.delete.useMutation({
    onSuccess: () => {
      utils.buildings.list.invalidate();
      toast.success("Building deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete building"),
  });

  function resetForm() {
    setFormOrgId("");
    setFormName("");
    setFormAddress("");
    setFormSuburb("");
    setFormState("");
    setFormPostcode("");
    setFormFloors("");
    setFormUnits("");
    setFormStrataNo("");
  }

  function handleCreate() {
    if (
      !formOrgId ||
      !formName.trim() ||
      !formAddress.trim() ||
      !formSuburb.trim() ||
      !formState ||
      !formPostcode.trim() ||
      !formFloors ||
      !formUnits
    )
      return;

    createMutation.mutate({
      organisationId: formOrgId,
      name: formName.trim(),
      address: formAddress.trim(),
      suburb: formSuburb.trim(),
      state: formState,
      postcode: formPostcode.trim(),
      totalFloors: parseInt(formFloors),
      totalUnits: parseInt(formUnits),
      strataSchemeNo: formStrataNo.trim() || undefined,
    });
  }

  const buildings = buildingsQuery.data ?? [];
  const orgs = orgsQuery.data ?? [];

  const filtered = buildings.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.suburb.toLowerCase().includes(search.toLowerCase()) ||
      b.organisation.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buildings</h1>
          <p className="text-muted-foreground">
            Manage all buildings across organisations
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            New Building
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Building</DialogTitle>
              <DialogDescription>
                Add a new building to an organisation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Organisation *</Label>
                <Select value={formOrgId} onValueChange={(v) => { if (v) setFormOrgId(v); }} itemToStringLabel={(v) => orgs.find(o => o.id === v)?.name ?? String(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id} label={org.name}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bName">Building Name *</Label>
                <Input
                  id="bName"
                  placeholder="e.g. Harbour View Apartments"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bAddress">Street Address *</Label>
                <Input
                  id="bAddress"
                  placeholder="e.g. 123 Main Street"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bSuburb">Suburb *</Label>
                  <Input
                    id="bSuburb"
                    placeholder="e.g. Sydney"
                    value={formSuburb}
                    onChange={(e) => setFormSuburb(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bPostcode">Postcode *</Label>
                  <Input
                    id="bPostcode"
                    placeholder="2000"
                    maxLength={4}
                    value={formPostcode}
                    onChange={(e) => setFormPostcode(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select
                  value={formState}
                  onValueChange={(v) => setFormState(v as AustralianStateValue)}
                  itemToStringLabel={(v) => AUSTRALIAN_STATES.find(s => s.value === v)?.label ?? String(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUSTRALIAN_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value} label={s.label}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bFloors">Total Floors *</Label>
                  <Input
                    id="bFloors"
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    value={formFloors}
                    onChange={(e) => setFormFloors(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bUnits">Total Units *</Label>
                  <Input
                    id="bUnits"
                    type="number"
                    min="1"
                    placeholder="e.g. 48"
                    value={formUnits}
                    onChange={(e) => setFormUnits(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bStrata">Strata Scheme No. (optional)</Label>
                <Input
                  id="bStrata"
                  placeholder="e.g. SP 12345"
                  value={formStrataNo}
                  onChange={(e) => setFormStrataNo(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !formOrgId ||
                  !formName.trim() ||
                  !formAddress.trim() ||
                  !formSuburb.trim() ||
                  !formState ||
                  !formPostcode.trim() ||
                  !formFloors ||
                  !formUnits ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Building"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search buildings..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Building</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildingsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {search
                      ? "No buildings match your search."
                      : "No buildings yet. Create one to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.address}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.organisation.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.suburb}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.state}</Badge>
                    </TableCell>
                    <TableCell>{b._count.units}</TableCell>
                    <TableCell>{b._count.assignments}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Building</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() =>
                              deleteMutation.mutate({ id: b.id })
                            }
                          >
                            Delete
                          </DropdownMenuItem>
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
    </div>
  );
}
