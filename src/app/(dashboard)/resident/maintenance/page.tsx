"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Clock3, Plus, Wrench } from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS as PRIORITY_LABELS_CONST,
  CATEGORY_LABELS,
} from "@/lib/constants";

const PRIORITY_LABELS: Record<string, string> = PRIORITY_LABELS_CONST;

export default function ResidentMaintenancePage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [priority, setPriority] = useState("MEDIUM");

  const { data: requests = [], isLoading, refetch } = trpc.resident.getMyMaintenanceRequests.useQuery({});
  const { data: profile } = trpc.resident.getMyProfile.useQuery();

  const allUnits = [
    ...(profile?.ownerships ?? []).map((o) => o.unit),
    ...(profile?.tenancies ?? []).map((t) => t.unit),
  ];
  const resolvedUnitId = unitId || (allUnits.length === 1 ? allUnits[0]?.id ?? "" : "");

  const createRequest = trpc.resident.createMaintenanceRequest.useMutation({
    onSuccess: () => {
      toast.success("Maintenance request submitted");
      setCreateOpen(false);
      setTitle(""); setDescription(""); setCategory("OTHER"); setPriority("MEDIUM"); setUnitId("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!resolvedUnitId) return toast.error("Please select a unit");
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    createRequest.mutate({
      unitId: resolvedUnitId,
      title,
      description,
      category: category as "OTHER",
      priority: priority as "MEDIUM",
    });
  }

  const activeCount = requests.filter(
    (r) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(r.status)
  ).length;
  const urgentCount = requests.filter((r) => r.priority === "URGENT").length;
  const completedCount = requests.filter((r) => r.status === "COMPLETED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Maintenance requests
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Report issues, keep track of active jobs, and follow status updates from building management.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="h-11 rounded-xl px-5" />}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </DialogTrigger>
            <DialogContent className="max-w-lg p-0">
              <DialogHeader>
                <DialogTitle className="px-6 pt-6">New Maintenance Request</DialogTitle>
                <DialogDescription className="px-6">
                  Share the issue clearly so building management can route it to the right team.
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto px-7 pb-6">
                <div className="flex flex-col gap-5 py-6">
                  <div className="flex flex-col gap-5">
                    {allUnits.length > 1 && (
                      <div className="flex flex-col gap-1.5">
                        <Label>Unit</Label>
                        <Select
                          value={unitId}
                          onValueChange={(v) => v !== null && setUnitId(v)}
                          itemToStringLabel={(v) => { const u = allUnits.find(u => u.id === v); return u ? `Unit ${u.unitNumber}` : String(v); }}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {allUnits.map((u) => (
                              <SelectItem key={u.id} value={u.id} label={`Unit ${u.unitNumber}`}>
                                Unit {u.unitNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {allUnits.length === 1 && (
                      <div className="flex flex-col gap-1.5">
                        <Label>Unit</Label>
                        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                          Unit {allUnits[0]?.unitNumber}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label>Title <span className="text-destructive">*</span></Label>
                      <Input
                        className="h-11 rounded-xl bg-background"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Leaking tap in bathroom"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Description <span className="text-destructive">*</span></Label>
                      <Textarea
                        className="min-h-32 rounded-xl bg-background"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Request details
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Set the type of issue and urgency level so the request reaches the right queue faster.
                    </p>
                    <div className="mt-4 flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5">
                        <Label>Category</Label>
                        <Select
                          value={category}
                          onValueChange={(v) => v !== null && setCategory(v)}
                          itemToStringLabel={(v) => CATEGORY_LABELS[v] ?? String(v)}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Priority</Label>
                        <Select
                          value={priority}
                          onValueChange={(v) => v !== null && setPriority(v)}
                          itemToStringLabel={(v) => PRIORITY_LABELS[v] ?? String(v)}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="px-7">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createRequest.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createRequest.isPending}>
                  {createRequest.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <ResidentMaintenanceMetric icon={Clock3} label="Active requests" value={`${activeCount}`} tone={activeCount > 0 ? "default" : "muted"} />
        <ResidentMaintenanceMetric icon={AlertCircle} label="Urgent items" value={`${urgentCount}`} tone={urgentCount > 0 ? "warning" : "muted"} />
        <ResidentMaintenanceMetric icon={Wrench} label="Completed jobs" value={`${completedCount}`} tone="positive" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Request history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Click any row to view details and add photos</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 px-6 py-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No maintenance requests yet. Submit one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Request</TableHead>
                  <TableHead className="px-4 py-3">Unit</TableHead>
                  <TableHead className="px-4 py-3">Category</TableHead>
                  <TableHead className="px-4 py-3">Priority</TableHead>
                  <TableHead className="px-4 py-3">Date</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/resident/maintenance/${req.id}`)}
                  >
                    <TableCell className="max-w-xs px-4 py-3 font-medium">{req.title}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">{req.unit.unitNumber}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {CATEGORY_LABELS[req.category] ?? req.category}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {PRIORITY_LABELS[req.priority] ?? req.priority}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString("en-AU")}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={STATUS_COLORS[req.status] ?? ""}>
                        {STATUS_LABELS[req.status] ?? req.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function ResidentMaintenanceMetric({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "default" | "warning" | "positive" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-accent/55 text-accent-foreground",
    warning: "bg-orange-100 text-orange-700",
    positive: "bg-emerald-100 text-emerald-700",
    muted: "bg-secondary text-secondary-foreground",
  };

  return (
    <section className="app-grid-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}
