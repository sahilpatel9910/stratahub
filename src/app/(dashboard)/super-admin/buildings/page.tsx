"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Building2, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { BuildingForEdit } from "./_edit-dialog";

const CreateBuildingDialog = dynamic(() => import("./_create-dialog"), {
  ssr: false,
});
const EditBuildingDialog = dynamic(() => import("./_edit-dialog"), {
  ssr: false,
});

export default function SuperAdminBuildingsPage() {
  const [search, setSearch] = useState("");
  const [editingBuilding, setEditingBuilding] = useState<BuildingForEdit | null>(null);

  const utils = trpc.useUtils();

  const buildingsQuery = trpc.buildings.list.useQuery({});
  const orgsQuery = trpc.organisations.list.useQuery();

  const deleteMutation = trpc.buildings.delete.useMutation({
    onSuccess: () => {
      utils.buildings.list.invalidate();
      toast.success("Building deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete building"),
  });

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
        <CreateBuildingDialog orgs={orgs} />
      </div>

      <EditBuildingDialog
        open={!!editingBuilding}
        onOpenChange={(open) => !open && setEditingBuilding(null)}
        building={editingBuilding}
      />

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
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditingBuilding({
                                id: b.id,
                                organisationId: b.organisationId,
                                name: b.name,
                                address: b.address,
                                suburb: b.suburb,
                                state: b.state,
                                postcode: b.postcode,
                                totalFloors: b.totalFloors,
                                totalUnits: b.totalUnits,
                                strataSchemeNo: b.strataSchemeNo,
                                orgName: b.organisation.name,
                              })
                            }
                          >
                            Edit Building
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteMutation.mutate({ id: b.id })}
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
