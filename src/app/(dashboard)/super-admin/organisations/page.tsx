"use client";

import { useState } from "react";
import { Building2, Plus, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
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
import { Label } from "@/components/ui/label";
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

export default function OrganisationsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAbn, setFormAbn] = useState("");
  const [formState, setFormState] = useState<AustralianStateValue | "">("");

  const utils = trpc.useUtils();

  const listQuery = trpc.organisations.list.useQuery();

  const createMutation = trpc.organisations.create.useMutation({
    onSuccess: () => {
      utils.organisations.list.invalidate();
      setDialogOpen(false);
      setFormName("");
      setFormAbn("");
      setFormState("");
      toast.success("Organisation created");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create organisation");
    },
  });

  const updateMutation = trpc.organisations.update.useMutation({
    onSuccess: () => {
      utils.organisations.list.invalidate();
      toast.success("Organisation updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update organisation");
    },
  });

  const organisations = listQuery.data ?? [];

  const filtered = organisations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleCreate() {
    if (!formName.trim()) return;
    if (!formState) return;
    createMutation.mutate({
      name: formName.trim(),
      abn: formAbn.trim() || undefined,
      state: formState,
    });
  }

  function handleDeactivate(id: string, isActive: boolean) {
    updateMutation.mutate({ id, isActive: !isActive });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
          <p className="text-muted-foreground">
            Manage organisations across Australia
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organisation</DialogTitle>
              <DialogDescription>
                Add a new property management organisation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation Name</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. Sydney Strata Group"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN (optional)</Label>
                <Input
                  id="abn"
                  placeholder="XX XXX XXX XXX"
                  value={formAbn}
                  onChange={(e) => setFormAbn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formState}
                  onValueChange={(v) =>
                    setFormState(v as AustralianStateValue)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUSTRALIAN_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={
                  !formName.trim() ||
                  !formState ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Organisation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organisations..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>ABN</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Buildings</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </TableCell>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {search ? "No organisations match your search." : "No organisations yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{org.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.abn ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.state}</Badge>
                    </TableCell>
                    <TableCell>{org._count.buildings}</TableCell>
                    <TableCell>{org._count.members}</TableCell>
                    <TableCell>
                      <Badge variant={org.isActive ? "default" : "secondary"}>
                        {org.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Manage Buildings</DropdownMenuItem>
                          <DropdownMenuItem
                            className={
                              org.isActive ? "text-red-600" : "text-green-600"
                            }
                            onClick={() =>
                              handleDeactivate(org.id, org.isActive)
                            }
                          >
                            {org.isActive ? "Deactivate" : "Reactivate"}
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
