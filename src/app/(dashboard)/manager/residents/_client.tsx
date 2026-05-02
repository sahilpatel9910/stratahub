"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { skipToken } from "@tanstack/react-query";
import { Home, Phone, Search, Users, UserRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";

const InviteResidentDialog = dynamic(() => import("./_invite-dialog"), {
  ssr: false,
});

type RoleFilter = "all" | "owner" | "tenant";

export default function ResidentsClient() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<RoleFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const { selectedBuildingId } = useBuildingContext();

  const query = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

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
              <TabsTrigger value="all">All ({allResidents.length})</TabsTrigger>
              <TabsTrigger value="owner">Owners ({ownerCount})</TabsTrigger>
              <TabsTrigger value="tenant">Tenants ({tenantCount})</TabsTrigger>
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
              onClick={() => setInviteOpen(true)}
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

                        const hasName = resident.firstName.trim() || resident.lastName.trim();
                        const displayName = hasName
                          ? `${resident.firstName} ${resident.lastName}`.trim()
                          : resident.email;
                        const initials = hasName
                          ? `${resident.firstName[0] ?? ""}${resident.lastName[0] ?? ""}`.toUpperCase()
                          : resident.email.slice(0, 2).toUpperCase();

                        return (
                          <TableRow
                            key={resident.id}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className={`text-sm ${resident.isActivated ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{displayName}</p>
                                    {!resident.isActivated && (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                                        Invited
                                      </Badge>
                                    )}
                                  </div>
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
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {leaseEnd ? (
                                <span className="text-sm">
                                  {new Date(leaseEnd).toLocaleDateString("en-AU")}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
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

      <InviteResidentDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        selectedBuildingId={selectedBuildingId}
      />
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
