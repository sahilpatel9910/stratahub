"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Search, Phone } from "lucide-react";
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
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";

type RoleFilter = "all" | "owner" | "tenant";

export default function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<RoleFilter>("all");

  const { selectedBuildingId } = useBuildingContext();

  const roleInput =
    tab === "owner" ? "OWNER" : tab === "tenant" ? "TENANT" : undefined;

  const query = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId
      ? { buildingId: selectedBuildingId, role: roleInput, search: search || undefined }
      : skipToken,
    { placeholderData: (prev) => prev }
  );

  const residents = query.data ?? [];

  const ownerCount = residents.filter((r) => r.buildingRole === "OWNER").length;
  const tenantCount = residents.filter((r) => r.buildingRole === "TENANT").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Residents</h1>
          <p className="text-muted-foreground">
            Manage owners and tenants in your building
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Resident
        </Button>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view residents.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as RoleFilter)}>
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="all">
                All ({residents.length})
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
                          No residents found.
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
    </div>
  );
}
