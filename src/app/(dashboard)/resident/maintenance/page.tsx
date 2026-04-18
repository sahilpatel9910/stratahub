"use client";

import { useRef, useState } from "react";
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
import { AlertCircle, Clock3, Image as ImageIcon, Plus, Upload, Wrench, X } from "lucide-react";
import { skipToken } from "@tanstack/react-query";

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

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-gray-100 text-gray-800",
  ACKNOWLEDGED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_PARTS: "bg-orange-100 text-orange-800",
  SCHEDULED: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-800",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent",
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plumbing", ELECTRICAL: "Electrical", HVAC: "HVAC",
  STRUCTURAL: "Structural", APPLIANCE: "Appliance", PEST_CONTROL: "Pest Control",
  CLEANING: "Cleaning", SECURITY: "Security", LIFT: "Lift",
  COMMON_AREA: "Common Area", OTHER: "Other",
};

export default function ResidentMaintenancePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [priority, setPriority] = useState("MEDIUM");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

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
            <DialogContent className="max-w-2xl p-0">
              <DialogHeader>
                <DialogTitle className="px-6 pt-6">New Maintenance Request</DialogTitle>
                <DialogDescription className="px-6">
                  Share the issue clearly so building management can route it to the right team.
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto px-6 pb-6">
                <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.9fr)]">
                  <div className="space-y-4">
                    {allUnits.length > 1 && (
                      <div className="space-y-2">
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
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                          Unit {allUnits[0]?.unitNumber}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        className="h-11 rounded-xl bg-background"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Leaking tap in bathroom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
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
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
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
              <DialogFooter className="px-6">
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
                    onClick={() => setSelectedRequestId(req.id)}
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

      {/* Detail dialog */}
      <ResidentMaintenanceDetail
        requestId={selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
      />
    </div>
  );
}

// ─── Resident Detail Dialog ───────────────────────────────────────────────────

function ResidentMaintenanceDetail({
  requestId,
  onClose,
}: {
  requestId: string | null;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const detailQuery = trpc.maintenance.getById.useQuery(
    requestId ? { id: requestId } : skipToken
  );

  const addImageMutation = trpc.maintenance.addImage.useMutation({
    onSuccess: () => {
      utils.maintenance.getById.invalidate({ id: requestId! });
      toast.success("Photo added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add photo"),
  });

  const deleteImageMutation = trpc.maintenance.deleteImage.useMutation({
    onSuccess: () => {
      utils.maintenance.getById.invalidate({ id: requestId! });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(err.message ?? "Failed to remove photo"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !requestId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/maintenance-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          maintenanceRequestId: requestId,
        }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
      }
      const { signedUrl, path } = await urlRes.json() as { signedUrl: string; path: string };

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      await addImageMutation.mutateAsync({
        maintenanceRequestId: requestId,
        storagePath: path,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const req = detailQuery.data;

  return (
    <Dialog open={!!requestId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          {detailQuery.isLoading ? (
            <Skeleton className="h-6 w-64" />
          ) : req ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-semibold">{req.title}</DialogTitle>
                <DialogDescription className="mt-1">
                  Unit {req.unit.unitNumber} · submitted {new Date(req.createdAt).toLocaleDateString("en-AU")}
                </DialogDescription>
              </div>
              <span className={`shrink-0 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[req.status] ?? req.status}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {detailQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : req ? (
            <>
              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[req.category] ?? req.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {PRIORITY_LABELS[req.priority] ?? req.priority}
                </Badge>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Description</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{req.description}</p>
              </div>

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Photos ({req.images.length})
                  </p>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || addImageMutation.isPending}
                    >
                      <Upload className="mr-1.5 h-3 w-3" />
                      {uploading ? "Uploading..." : "Add Photo"}
                    </Button>
                  </div>
                </div>

                {req.images.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    No photos attached. Add one to help describe the issue.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {req.images.map((img) => (
                      <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                        {img.displayUrl ? (
                          <img
                            src={img.displayUrl}
                            alt={img.caption ?? "Maintenance photo"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-8 w-8 opacity-30" />
                          </div>
                        )}
                        <button
                          className="absolute right-1.5 top-1.5 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow"
                          onClick={() => deleteImageMutation.mutate({ id: img.id })}
                          disabled={deleteImageMutation.isPending}
                          aria-label="Remove photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {img.caption && (
                          <p className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-[10px] text-white truncate">
                            {img.caption}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status history / comments */}
              {req.comments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                    Updates ({req.comments.length})
                  </p>
                  <div className="space-y-3">
                    {req.comments.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-foreground">
                            {c.user.firstName} {c.user.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("en-AU")}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
