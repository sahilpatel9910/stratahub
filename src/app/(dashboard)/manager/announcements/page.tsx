"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const SCOPE_LABELS: Record<string, string> = {
  BUILDING: "Whole Building",
  FLOOR: "Specific Floors",
  ALL_BUILDINGS: "All Buildings",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AnnouncementsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [createOpen, setCreateOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formPriority, setFormPriority] = useState("MEDIUM");
  const [formScope, setFormScope] = useState("BUILDING");
  const [formExpiresAt, setFormExpiresAt] = useState("");

  const utils = trpc.useUtils();

  const query = trpc.announcements.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.announcements.create.useMutation({
    onSuccess: () => {
      utils.announcements.listByBuilding.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Announcement published");
    },
    onError: (err) => toast.error(err.message ?? "Failed to publish announcement"),
  });

  const deleteMutation = trpc.announcements.delete.useMutation({
    onSuccess: () => {
      utils.announcements.listByBuilding.invalidate();
      toast.success("Announcement deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete announcement"),
  });

  function resetForm() {
    setFormTitle("");
    setFormContent("");
    setFormPriority("MEDIUM");
    setFormScope("BUILDING");
    setFormExpiresAt("");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formTitle.trim() || !formContent.trim()) return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      title: formTitle.trim(),
      content: formContent.trim(),
      priority: formPriority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      scope: formScope as "BUILDING" | "FLOOR" | "ALL_BUILDINGS",
      targetFloors: [],
      expiresAt: formExpiresAt || undefined,
    });
  }

  const announcements = query.data ?? [];
  const urgentCount = announcements.filter((announcement) => announcement.priority === "URGENT").length;
  const scheduledExpiryCount = announcements.filter((announcement) => !!announcement.expiresAt).length;

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Announcements and building notices
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Publish updates for residents and staff, highlight urgent disruptions, and keep important notices visible.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Broadcast status</p>
            <div className="mt-4 space-y-3">
              <AnnouncementSignal label="Live announcements" value={`${announcements.length}`} />
              <AnnouncementSignal label="Urgent notices" value={`${urgentCount}`} />
              <AnnouncementSignal label="Timed expiry" value={`${scheduledExpiryCount}`} />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Announcement feed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Broadcast messages to residents and staff
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button disabled={!selectedBuildingId} className="h-11 rounded-xl px-5" />}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </DialogTrigger>
          <DialogContent className="max-w-2xl p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">New Announcement</DialogTitle>
              <DialogDescription className="px-6">
                Publish a notice to building residents
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6">
              <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="annTitle">Title *</Label>
                    <Input
                      id="annTitle"
                      className="h-11 rounded-xl bg-background"
                      placeholder="e.g. Water Shutdown Notice"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annContent">Message *</Label>
                    <Textarea
                      id="annContent"
                      className="min-h-32 rounded-xl bg-background"
                      placeholder="Announcement details..."
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Delivery settings
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose how broadly the notice should be seen and when it should expire from the feed.
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formPriority} onValueChange={(v) => { if (v) setFormPriority(v); }} itemToStringLabel={(v) => PRIORITY_LABELS[v] ?? String(v)}>
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
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select value={formScope} onValueChange={(v) => { if (v) setFormScope(v); }} itemToStringLabel={(v) => SCOPE_LABELS[v] ?? String(v)}>
                        <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SCOPE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiresAt">Expires (optional)</Label>
                      <Input
                        id="expiresAt"
                        className="h-11 rounded-xl bg-background"
                        type="date"
                        value={formExpiresAt}
                        onChange={(e) => setFormExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="px-6">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !formTitle.trim() ||
                  !formContent.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Publishing..." : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view announcements.
          </CardContent>
        </Card>
      ) : query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No active announcements.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Publish a notice to keep residents informed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{ann.title}</h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          PRIORITY_STYLES[ann.priority] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {PRIORITY_LABELS[ann.priority] ?? ann.priority}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {SCOPE_LABELS[ann.scope] ?? ann.scope}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {ann.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        By {ann.author.firstName} {ann.author.lastName}
                      </span>
                      <span>·</span>
                      <span>{formatDate(ann.createdAt)}</span>
                      {ann.expiresAt && (
                        <>
                          <span>·</span>
                          <span>Expires {formatDate(ann.expiresAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete announcement ${ann.title}`}
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: ann.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementSignal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
