"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Trash2, Megaphone } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">
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
          <DialogTrigger render={<Button disabled={!selectedBuildingId} />}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Announcement</DialogTitle>
              <DialogDescription>
                Publish a notice to building residents
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="annTitle">Title *</Label>
                <Input
                  id="annTitle"
                  placeholder="e.g. Water Shutdown Notice"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annContent">Message *</Label>
                <Textarea
                  id="annContent"
                  placeholder="Announcement details..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formPriority} onValueChange={(v) => { if (v) setFormPriority(v); }} itemToStringLabel={(v) => PRIORITY_LABELS[v] ?? String(v)}>
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCOPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
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
