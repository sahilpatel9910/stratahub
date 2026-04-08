"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Search, AlertTriangle, MoreHorizontal } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";

type TabValue = "all" | "active" | "inactive";
type KeyTypeFilter = "ALL" | "PHYSICAL_KEY" | "FOB" | "ACCESS_CODE" | "REMOTE" | "SWIPE_CARD";

const KEY_TYPE_LABELS: Record<string, string> = {
  PHYSICAL_KEY: "Physical Key",
  FOB: "Fob",
  ACCESS_CODE: "Access Code",
  REMOTE: "Remote",
  SWIPE_CARD: "Swipe Card",
};

const KEY_TYPES = Object.entries(KEY_TYPE_LABELS) as [string, string][];

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(date: Date | string | null | undefined) {
  if (!date) return false;
  return new Date(date) < new Date();
}

export default function KeysPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState<TabValue>("all");
  const [typeFilter, setTypeFilter] = useState<KeyTypeFilter>("ALL");
  const [search, setSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [formKeyType, setFormKeyType] = useState<string>("PHYSICAL_KEY");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formUnitId, setFormUnitId] = useState("");
  const [formIssuedTo, setFormIssuedTo] = useState("");
  const [formIssuedDate, setFormIssuedDate] = useState("");
  const [formRotationDue, setFormRotationDue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Issue dialog
  const [issueDialogKey, setIssueDialogKey] = useState<{
    id: string;
    identifier: string;
  } | null>(null);
  const [issueToName, setIssueToName] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.keys.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.keys.create.useMutation({
    onSuccess: () => {
      utils.keys.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Key record created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create key"),
  });

  const issueMutation = trpc.keys.issue.useMutation({
    onSuccess: () => {
      utils.keys.listByBuilding.invalidate();
      setIssueDialogKey(null);
      setIssueToName("");
      toast.success("Key issued");
    },
    onError: (err) => toast.error(err.message ?? "Failed to issue key"),
  });

  const returnMutation = trpc.keys.returnKey.useMutation({
    onSuccess: () => {
      utils.keys.listByBuilding.invalidate();
      toast.success("Key returned");
    },
    onError: (err) => toast.error(err.message ?? "Failed to return key"),
  });

  const deactivateMutation = trpc.keys.deactivate.useMutation({
    onSuccess: () => {
      utils.keys.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      toast.success("Key deactivated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to deactivate key"),
  });

  function resetCreateForm() {
    setFormKeyType("PHYSICAL_KEY");
    setFormIdentifier("");
    setFormUnitId("");
    setFormIssuedTo("");
    setFormIssuedDate("");
    setFormRotationDue("");
    setFormNotes("");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formIdentifier.trim()) return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      keyType: formKeyType as Parameters<typeof createMutation.mutate>[0]["keyType"],
      identifier: formIdentifier.trim(),
      unitId: formUnitId || undefined,
      issuedTo: formIssuedTo.trim() || undefined,
      issuedDate: formIssuedDate || undefined,
      rotationDue: formRotationDue || undefined,
      notes: formNotes.trim() || undefined,
    });
  }

  function handleIssue() {
    if (!issueDialogKey || !issueToName.trim()) return;
    issueMutation.mutate({ id: issueDialogKey.id, issuedTo: issueToName.trim() });
  }

  const allKeys = query.data ?? [];
  const units = unitsQuery.data ?? [];

  const filtered = allKeys
    .filter((k) => {
      if (tab === "active") return k.isActive;
      if (tab === "inactive") return !k.isActive;
      return true;
    })
    .filter((k) => typeFilter === "ALL" || k.keyType === typeFilter)
    .filter(
      (k) =>
        !search ||
        k.identifier.toLowerCase().includes(search.toLowerCase()) ||
        (k.issuedTo ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (k.unit?.unitNumber ?? "").includes(search)
    );

  const activeCount = allKeys.filter((k) => k.isActive).length;
  const inactiveCount = allKeys.filter((k) => !k.isActive).length;
  const rotationDueCount = allKeys.filter(
    (k) => k.isActive && isOverdue(k.rotationDue)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Keys & Access</h1>
          <p className="text-muted-foreground">
            Manage physical keys, fobs, and access credentials
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!selectedBuildingId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Key Record</DialogTitle>
              <DialogDescription>
                Register a new key or access credential for this building
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Key Type *</Label>
                <Select value={formKeyType} onValueChange={setFormKeyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEY_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="identifier">Identifier *</Label>
                <Input
                  id="identifier"
                  placeholder="e.g. K-101-A, FOB-042"
                  value={formIdentifier}
                  onChange={(e) => setFormIdentifier(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Unit (optional)</Label>
                <Select
                  value={formUnitId}
                  onValueChange={setFormUnitId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not unit-specific" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not unit-specific</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        Unit {u.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="issuedTo">Issued To (optional)</Label>
                <Input
                  id="issuedTo"
                  placeholder="Resident or staff name"
                  value={formIssuedTo}
                  onChange={(e) => setFormIssuedTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuedDate">Issued Date</Label>
                <Input
                  id="issuedDate"
                  type="date"
                  value={formIssuedDate}
                  onChange={(e) => setFormIssuedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rotationDue">Rotation Due</Label>
                <Input
                  id="rotationDue"
                  type="date"
                  value={formRotationDue}
                  onChange={(e) => setFormRotationDue(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="keyNotes">Notes</Label>
                <Textarea
                  id="keyNotes"
                  placeholder="Any additional notes..."
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
                disabled={!formIdentifier.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rotation due warning banner */}
      {rotationDueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{rotationDueCount}</strong> key
            {rotationDueCount !== 1 ? "s have" : " has"} passed their
            rotation due date and should be replaced.
          </span>
        </div>
      )}

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view keys.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="all">All ({allKeys.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="inactive">
                Inactive ({inactiveCount})
              </TabsTrigger>
            </TabsList>

            <div className="ml-auto flex items-center gap-2">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as KeyTypeFilter)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {KEY_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-52">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search identifier or name..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Issued To</TableHead>
                      <TableHead>Issued Date</TableHead>
                      <TableHead>Rotation Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Action</TableHead>
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
                          {search || typeFilter !== "ALL"
                            ? "No keys match your filters."
                            : "No key records found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((key) => {
                        const isCurrentlyIssued =
                          !!key.issuedTo && !key.returnedDate;
                        const rotationOverdue =
                          key.isActive && isOverdue(key.rotationDue);
                        const lastLog = key.logs[0];

                        return (
                          <TableRow key={key.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono font-medium">
                              {key.identifier}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {KEY_TYPE_LABELS[key.keyType] ?? key.keyType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {key.unit ? `Unit ${key.unit.unitNumber}` : "—"}
                            </TableCell>
                            <TableCell>
                              {key.issuedTo ? (
                                <span className="text-sm">{key.issuedTo}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Unissued
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(key.issuedDate)}
                            </TableCell>
                            <TableCell>
                              {key.rotationDue ? (
                                <span
                                  className={`text-sm ${
                                    rotationOverdue
                                      ? "font-medium text-orange-600"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {rotationOverdue && (
                                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                                  )}
                                  {formatDate(key.rotationDue)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  !key.isActive
                                    ? "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                    : isCurrentlyIssued
                                      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                      : "bg-green-100 text-green-800 hover:bg-green-100"
                                }
                              >
                                {!key.isActive
                                  ? "Inactive"
                                  : isCurrentlyIssued
                                    ? "Issued"
                                    : "Available"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {lastLog ? (
                                <span>
                                  {lastLog.action}{" "}
                                  <span className="text-muted-foreground/60">
                                    {formatDate(lastLog.timestamp)}
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {key.isActive && !isCurrentlyIssued && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setIssueDialogKey({
                                          id: key.id,
                                          identifier: key.identifier,
                                        });
                                        setIssueToName("");
                                      }}
                                    >
                                      Issue Key
                                    </DropdownMenuItem>
                                  )}
                                  {key.isActive && isCurrentlyIssued && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        returnMutation.mutate({ id: key.id })
                                      }
                                    >
                                      Return Key
                                    </DropdownMenuItem>
                                  )}
                                  {key.isActive && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() =>
                                          deactivateMutation.mutate({
                                            id: key.id,
                                          })
                                        }
                                      >
                                        Deactivate
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {!key.isActive && (
                                    <DropdownMenuItem disabled>
                                      No actions available
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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

      {/* Issue Key Dialog */}
      <Dialog
        open={!!issueDialogKey}
        onOpenChange={(open) => {
          if (!open) {
            setIssueDialogKey(null);
            setIssueToName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Key</DialogTitle>
            <DialogDescription>
              {issueDialogKey && (
                <>Issuing key: <strong>{issueDialogKey.identifier}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="issueTo">Issue To *</Label>
              <Input
                id="issueTo"
                placeholder="Resident or staff name"
                value={issueToName}
                onChange={(e) => setIssueToName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIssue()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIssueDialogKey(null);
                setIssueToName("");
              }}
              disabled={issueMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIssue}
              disabled={!issueToName.trim() || issueMutation.isPending}
            >
              {issueMutation.isPending ? "Issuing..." : "Issue Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
