"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipToken } from "@tanstack/react-query";
import {
  AlertTriangle, ClipboardList, Image as ImageIcon, MessageSquare,
  MoreHorizontal, Plus, Search, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { MAINTENANCE_CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { toast } from "sonner";

type TabValue = "all" | "active" | "completed" | "cancelled";
type PriorityFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const ACTIVE_STATUSES = [
  "SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "AWAITING_PARTS", "SCHEDULED",
];
const COMPLETED_STATUSES = ["COMPLETED", "CLOSED"];

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  AWAITING_PARTS: "Awaiting Parts",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  ACKNOWLEDGED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_PARTS: "bg-orange-100 text-orange-800",
  SCHEDULED: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const NEXT_STATUSES: Record<string, string[]> = {
  SUBMITTED: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "SCHEDULED", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_PARTS", "SCHEDULED", "COMPLETED", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

const CATEGORIES = Object.entries(MAINTENANCE_CATEGORY_LABELS) as [
  keyof typeof MAINTENANCE_CATEGORY_LABELS, string,
][];

const PRIORITIES = Object.entries(PRIORITY_LABELS) as [
  keyof typeof PRIORITY_LABELS, string,
][];

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function MaintenanceClient() {
  const router = useRouter();
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState<TabValue>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [formUnitId, setFormUnitId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] =
    useState<keyof typeof MAINTENANCE_CATEGORY_LABELS>("OTHER");
  const [formPriority, setFormPriority] =
    useState<keyof typeof PRIORITY_LABELS>("MEDIUM");

  const utils = trpc.useUtils();

  const query = trpc.maintenance.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const updateStatusMutation = trpc.maintenance.updateStatus.useMutation({
    onSuccess: () => {
      utils.maintenance.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update status"),
  });

  const createMutation = trpc.maintenance.create.useMutation({
    onSuccess: () => {
      utils.maintenance.listByBuilding.invalidate();
      utils.buildings.getStats.invalidate();
      setCreateDialogOpen(false);
      resetCreateForm();
      toast.success("Maintenance request created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create request"),
  });

  function resetCreateForm() {
    setFormUnitId(""); setFormTitle(""); setFormDescription("");
    setFormCategory("OTHER"); setFormPriority("MEDIUM");
  }

  function handleCreate() {
    if (!formUnitId || !formTitle.trim() || !formDescription.trim()) return;
    createMutation.mutate({
      unitId: formUnitId,
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      priority: formPriority,
    });
  }

  const allRequests = query.data ?? [];

  const filtered = allRequests
    .filter((r) => {
      if (tab === "active") return ACTIVE_STATUSES.includes(r.status);
      if (tab === "completed") return COMPLETED_STATUSES.includes(r.status);
      if (tab === "cancelled") return r.status === "CANCELLED";
      return true;
    })
    .filter((r) => priorityFilter === "ALL" || r.priority === priorityFilter)
    .filter(
      (r) =>
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.unit.unitNumber.includes(search)
    );

  const activeCount = allRequests.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
  const completedCount = allRequests.filter((r) => COMPLETED_STATUSES.includes(r.status)).length;
  const cancelledCount = allRequests.filter((r) => r.status === "CANCELLED").length;

  const units = unitsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Maintenance queue and job tracking
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Review incoming issues, triage priority, and move requests through to completion without losing the audit trail.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Queue status</p>
            <div className="mt-4 space-y-3">
              <MaintenanceSignal icon={ClipboardList} label="All requests" value={`${allRequests.length}`} tone="text-slate-600" />
              <MaintenanceSignal icon={Wrench} label="Active jobs" value={`${activeCount}`} tone="text-blue-600" />
              <MaintenanceSignal icon={AlertTriangle} label="Cancelled" value={`${cancelledCount}`} tone="text-orange-600" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Maintenance requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any row to view details and manage photos
          </p>
        </div>
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger render={<Button disabled={!selectedBuildingId} className="h-11 rounded-xl px-5" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </DialogTrigger>
          <DialogContent className="max-w-lg p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">New Maintenance Request</DialogTitle>
              <DialogDescription className="px-6">
                Log a maintenance issue for a unit in this building
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-7 pb-6">
              <div className="flex flex-col gap-5 py-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Label>Unit <span className="text-destructive">*</span></Label>
                    <Select
                      value={formUnitId}
                      onValueChange={(v) => v !== null && setFormUnitId(v)}
                      itemToStringLabel={(v) => { const u = units.find(u => u.id === v); return u ? `Unit ${u.unitNumber}` : String(v); }}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => {
                          const resident = u.ownerships[0] || u.tenancies[0]
                            ? ` — ${u.ownerships[0] ? `${u.ownerships[0].user.firstName} ${u.ownerships[0].user.lastName}` : `${u.tenancies[0]!.user.firstName} ${u.tenancies[0]!.user.lastName}`}`
                            : "";
                          return (
                            <SelectItem key={u.id} value={u.id} label={`Unit ${u.unitNumber}${resident}`}>
                              Unit {u.unitNumber}{resident}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="title"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. Leaking tap in bathroom"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="description"
                      className="min-h-28 rounded-xl bg-background"
                      placeholder="Describe the issue in detail..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Triage details</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Categorise the issue properly so staff can prioritise urgent jobs and assign contractors faster.
                  </p>
                  <div className="mt-4 flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                      <Label>Category</Label>
                      <Select
                        value={formCategory}
                        onValueChange={(v) => setFormCategory(v as keyof typeof MAINTENANCE_CATEGORY_LABELS)}
                        itemToStringLabel={(v) => CATEGORIES.find(([val]) => val === v)?.[1] ?? String(v)}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(([value, label]) => (
                            <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Priority</Label>
                      <Select
                        value={formPriority}
                        onValueChange={(v) => setFormPriority(v as keyof typeof PRIORITY_LABELS)}
                        itemToStringLabel={(v) => PRIORITIES.find(([val]) => val === v)?.[1] ?? String(v)}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(([value, label]) => (
                            <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="px-7">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formUnitId || !formTitle.trim() || !formDescription.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view maintenance requests.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <div className="app-grid-panel flex flex-wrap items-center gap-3 p-4">
            <TabsList className="bg-background/80">
              <TabsTrigger value="all">All ({allRequests.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({cancelledCount})</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 ml-auto">
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
                itemToStringLabel={(v) => v === "ALL" ? "All Priorities" : PRIORITIES.find(([val]) => val === v)?.[1] ?? String(v)}
              >
                <SelectTrigger className="h-11 w-40 rounded-xl bg-background">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" label="All Priorities">All Priorities</SelectItem>
                  {PRIORITIES.map(([value, label]) => (
                    <SelectItem key={value} value={value} label={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search title or unit..."
                  className="h-11 rounded-xl bg-background pl-9"
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
                      <TableHead>Issue</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          No maintenance requests found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((req) => (
                        <TableRow
                          key={req.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/manager/maintenance/${req.id}`)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                {req.requestedBy.firstName} {req.requestedBy.lastName}
                                {req._count.comments > 0 && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <MessageSquare className="h-3 w-3" />
                                    {req._count.comments}
                                  </span>
                                )}
                                {req._count.images > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-blue-600">
                                    <ImageIcon className="h-3 w-3" />
                                    {req._count.images}
                                  </span>
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{req.unit.unitNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {MAINTENANCE_CATEGORY_LABELS[req.category as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? req.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[req.priority] ?? "bg-gray-100 text-gray-700"}`}>
                              {PRIORITY_LABELS[req.priority as keyof typeof PRIORITY_LABELS] ?? req.priority}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUS_LABELS[req.status] ?? req.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(req.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {req.assignedTo ?? "—"}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Open maintenance actions for ${req.title}`} className="h-8 w-8" disabled={updateStatusMutation.isPending} onClick={(e) => e.stopPropagation()} />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  Update Status
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(NEXT_STATUSES[req.status] ?? []).length === 0 ? (
                                  <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                                ) : (
                                  (NEXT_STATUSES[req.status] ?? []).map((nextStatus) => (
                                    <DropdownMenuItem
                                      key={nextStatus}
                                      onClick={() =>
                                        updateStatusMutation.mutate({
                                          id: req.id,
                                          status: nextStatus as Parameters<typeof updateStatusMutation.mutate>[0]["status"],
                                        })
                                      }
                                      className={
                                        nextStatus === "CANCELLED" ? "text-red-600" :
                                        nextStatus === "COMPLETED" || nextStatus === "CLOSED" ? "text-green-700" : ""
                                      }
                                    >
                                      → {STATUS_LABELS[nextStatus]}
                                    </DropdownMenuItem>
                                  ))
                                )}
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
          </TabsContent>
        </Tabs>
      )}

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MaintenanceSignal({
  icon: Icon, label, value, tone,
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
