"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Home, Phone, Search, Users, UserRound, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";

type RoleFilter = "all" | "owner" | "tenant";
type InviteRole = "OWNER" | "TENANT";

function getAppUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export default function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<RoleFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("TENANT");
  const [inviteUnitId, setInviteUnitId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const { selectedBuildingId } = useBuildingContext();
  const utils = trpc.useUtils();

  const query = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );
  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const inviteMutation = trpc.users.createManagerInvite.useMutation({
    onSuccess: (invite) => {
      setInviteLink(`${getAppUrl()}/invite/${invite.token}`);
      utils.residents.listByBuilding.invalidate();
      toast.success("Resident invite created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create invite"),
  });

  const allResidents = query.data ?? [];
  const residents = allResidents.filter((resident) => {
    if (tab === "owner" && resident.buildingRole !== "OWNER") return false;
    if (tab === "tenant" && resident.buildingRole !== "TENANT") return false;

    if (!search.trim()) return true;

    const term = search.trim().toLowerCase();
    return (
      resident.firstName.toLowerCase().includes(term) ||
      resident.lastName.toLowerCase().includes(term) ||
      resident.email.toLowerCase().includes(term)
    );
  });

  const ownerCount = allResidents.filter((r) => r.buildingRole === "OWNER").length;
  const tenantCount = allResidents.filter((r) => r.buildingRole === "TENANT").length;
  const units = unitsQuery.data ?? [];

  function resetInviteForm() {
    setInviteEmail("");
    setInviteRole("TENANT");
    setInviteUnitId("");
    setInviteLink("");
    setCopied(false);
  }

  function handleInvite() {
    if (!selectedBuildingId || !inviteEmail.trim() || !inviteUnitId) return;
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      buildingId: selectedBuildingId,
      unitId: inviteUnitId,
      role: inviteRole,
    });
  }

  async function handleCopyInviteLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Resident directory and occupancy
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Review owners and tenants in the building, keep contact details close at hand, and understand who is attached to each unit.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Resident mix</p>
            <div className="mt-4 space-y-3">
              <ResidentSignal icon={Users} label="All residents" value={`${allResidents.length}`} tone="text-slate-600" />
              <ResidentSignal icon={Home} label="Owners" value={`${ownerCount}`} tone="text-blue-600" />
              <ResidentSignal icon={UserRound} label="Tenants" value={`${tenantCount}`} tone="text-emerald-600" />
            </div>
          </div>
        </div>
      </section>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view residents.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as RoleFilter)}>
          <div className="app-grid-panel flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
            <TabsList className="bg-background/80">
              <TabsTrigger value="all">
                All ({allResidents.length})
              </TabsTrigger>
              <TabsTrigger value="owner">
                Owners ({ownerCount})
              </TabsTrigger>
              <TabsTrigger value="tenant">
                Tenants ({tenantCount})
              </TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="h-11 rounded-xl bg-background pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              className="h-11 rounded-xl px-5 lg:ml-auto"
              onClick={() => {
                resetInviteForm();
                setInviteOpen(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Resident
            </Button>
          </div>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resident</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Lease End</TableHead>
                      <TableHead>Emergency Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-9 w-9 rounded-full" />
                              <div className="space-y-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-44" />
                              </div>
                            </div>
                          </TableCell>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : residents.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground"
                        >
                          {allResidents.length === 0
                            ? "No residents found."
                            : "No residents match your current search or filter."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      residents.map((resident) => {
                        const unitNumber =
                          resident.buildingRole === "OWNER"
                            ? resident.ownerships[0]?.unit.unitNumber
                            : resident.tenancies[0]?.unit.unitNumber;

                        const leaseEnd = resident.tenancies[0]?.leaseEndDate;

                        const ec = resident.emergencyContacts[0];
                        const ecDisplay = ec
                          ? `${ec.name} (${ec.relationship}) — ${ec.phone}`
                          : "—";

                        const initials = `${resident.firstName[0]}${resident.lastName[0]}`;

                        return (
                          <TableRow
                            key={resident.id}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {resident.firstName} {resident.lastName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {resident.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {unitNumber ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  resident.buildingRole === "OWNER"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {resident.buildingRole === "OWNER"
                                  ? "Owner"
                                  : "Tenant"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {resident.phone ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {resident.phone}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {leaseEnd ? (
                                <span className="text-sm">
                                  {new Date(leaseEnd).toLocaleDateString(
                                    "en-AU"
                                  )}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {ecDisplay}
                              </span>
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
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) resetInviteForm();
        }}
      >
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader>
            <DialogTitle className="px-0 pt-0">Invite Resident</DialogTitle>
            <DialogDescription className="px-0">
              Send an invite for an owner or tenant in the selected building.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email *</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    className="h-12 rounded-xl"
                    placeholder="resident@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => value !== null && setInviteRole(value as InviteRole)}
                    itemToStringLabel={(value) =>
                      value === "OWNER" ? "Owner" : value === "TENANT" ? "Tenant" : String(value)
                    }
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TENANT" label="Tenant">
                        Tenant
                      </SelectItem>
                      <SelectItem value="OWNER" label="Owner">
                        Owner
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select
                    value={inviteUnitId}
                    onValueChange={(value) => value !== null && setInviteUnitId(value)}
                    itemToStringLabel={(value) => {
                      const unit = units.find((item) => item.id === value);
                      return unit ? `Unit ${unit.unitNumber}` : String(value);
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id} label={`Unit ${unit.unitNumber}`}>
                          Unit {unit.unitNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {inviteLink && (
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-sm font-medium text-foreground">Invite link ready</p>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="block flex-1 truncate rounded-xl bg-background px-3 py-2 text-xs">
                        {inviteLink}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl"
                        onClick={handleCopyInviteLink}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Invite scope
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Building managers can invite residents only into the currently selected building, only as an owner or tenant, and only for a specific unit.
                </p>
                <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">What happens next</p>
                  <p className="mt-2 leading-6">
                    Once the invite is accepted, the user will be linked to this building and unit. Owner invites create ownership immediately; tenant invites create an active tenancy placeholder that should be reviewed in Units or Rent.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviteMutation.isPending}
              className="h-11 rounded-xl px-5"
            >
              Close
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || !inviteUnitId || inviteMutation.isPending}
              className="h-11 rounded-xl px-5"
            >
              {inviteMutation.isPending ? "Creating..." : "Create Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResidentSignal({
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
