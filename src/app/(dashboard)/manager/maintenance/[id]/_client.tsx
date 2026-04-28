"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Upload, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
} from "@/lib/constants";

// ─── Status transition map ────────────────────────────────────────────────────

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

const TERMINAL_STATUSES = new Set(["CLOSED", "CANCELLED"]);

// ─── Status timeline ──────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "AWAITING_PARTS",
  "SCHEDULED",
  "COMPLETED",
] as const;

type TimelineStep = (typeof TIMELINE_STEPS)[number];

function getStepIndex(status: string): number {
  return TIMELINE_STEPS.indexOf(status as TimelineStep);
}

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isTerminal = currentIdx === -1;

  return (
    <section className="app-panel overflow-hidden p-6 md:p-8">
      <p className="eyebrow-label">Status</p>

      <div className="mt-6">
        <div className="flex items-start">
          {TIMELINE_STEPS.map((step, i) => {
            const isFilled = !isTerminal && i <= currentIdx;
            const isCurrent = !isTerminal && i === currentIdx;
            const isLast = i === TIMELINE_STEPS.length - 1;

            return (
              <div key={step} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className={`h-px flex-1 transition-colors ${
                        isFilled ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                  <div
                    className={`
                      relative flex items-center justify-center rounded-full transition-all
                      ${isCurrent ? "h-5 w-5" : "h-3.5 w-3.5"}
                      ${isFilled ? "bg-primary" : "border-2 border-border bg-background"}
                    `}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-2" />
                    )}
                    {isFilled && !isCurrent && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`h-px flex-1 transition-colors ${
                        !isTerminal && i < currentIdx ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
                <p
                  className={`mt-2 text-center text-[0.65rem] font-medium leading-tight ${
                    isCurrent
                      ? "text-primary font-semibold"
                      : isFilled
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {STATUS_LABELS[step]}
                </p>
              </div>
            );
          })}
        </div>

        {isTerminal && (
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              <div className="h-2 w-2 rounded-full bg-current opacity-70" />
              {STATUS_LABELS[status] ?? status}
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Skeleton panel ───────────────────────────────────────────────────────────

function SkeletonPanel() {
  return (
    <section className="app-panel overflow-hidden p-6 md:p-8">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerMaintenanceDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [comment, setComment] = useState("");
  const [assignInput, setAssignInput] = useState("");

  const utils = trpc.useUtils();
  const { data: req, isLoading, isError } = trpc.maintenance.getById.useQuery({ id });

  useEffect(() => {
    if (req?.assignedTo) setAssignInput(req.assignedTo);
  }, [req?.assignedTo]);

  const assignMutation = trpc.maintenance.assign.useMutation({
    onSuccess: () => {
      void utils.maintenance.getById.invalidate({ id });
      toast.success("Contractor assigned");
    },
    onError: (e) => toast.error(e.message ?? "Failed to assign"),
  });

  const updateStatusMutation = trpc.maintenance.updateStatus.useMutation({
    onSuccess: () => {
      void utils.maintenance.getById.invalidate({ id });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message ?? "Failed to update status"),
  });

  const addComment = trpc.maintenance.addComment.useMutation({
    onSuccess: () => {
      setComment("");
      void utils.maintenance.getById.invalidate({ id });
    },
    onError: (e) => toast.error(e.message ?? "Failed to send comment"),
  });

  const addImageMutation = trpc.maintenance.addImage.useMutation({
    onSuccess: () => {
      void utils.maintenance.getById.invalidate({ id });
      toast.success("Photo added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add photo"),
  });

  const deleteImageMutation = trpc.maintenance.deleteImage.useMutation({
    onSuccess: () => {
      void utils.maintenance.getById.invalidate({ id });
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(err.message ?? "Failed to remove photo"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      e.target.value = "";
      return;
    }
    setPendingFile({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  function cancelPendingFile() {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    const { file } = pendingFile;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/maintenance-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          maintenanceRequestId: id,
        }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
      }
      const { signedUrl, path } = (await urlRes.json()) as { signedUrl: string; path: string };
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      await addImageMutation.mutateAsync({ maintenanceRequestId: id, storagePath: path });
      cancelPendingFile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  const nextStatuses = req ? (NEXT_STATUSES[req.status] ?? []) : [];
  const isTerminal = req ? TERMINAL_STATUSES.has(req.status) : false;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* ── Header panel ─────────────────────────────────────────────────────── */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <Link
          href="/manager/maintenance"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          Maintenance
        </Link>

        <p className="eyebrow-label text-primary/80">Manager Workspace</p>

        {isLoading ? (
          <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-muted" />
        ) : (
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
            {req?.title ?? "Request not found"}
          </h1>
        )}
      </section>

      {isLoading && (
        <>
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </>
      )}

      {isError && (
        <section className="app-panel overflow-hidden p-6 md:p-8">
          <p className="text-sm text-muted-foreground">
            Could not load this maintenance request. It may not exist or you may not have
            permission to view it.
          </p>
          <Link
            href="/manager/maintenance"
            className="mt-3 inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to maintenance
          </Link>
        </section>
      )}

      {req && !isLoading && (
        <>
          {/* ── Request details panel ──────────────────────────────────────── */}
          <section className="app-panel overflow-hidden p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <p className="eyebrow-label">Request details</p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {STATUS_LABELS[req.status] ?? req.status}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <MetaRow label="Unit" value={`Unit ${req.unit.unitNumber}`} />
              <MetaRow label="Building" value={req.unit.building.name} />
              <MetaRow
                label="Reported by"
                value={`${req.requestedBy.firstName} ${req.requestedBy.lastName}`}
              />
              <MetaRow
                label="Category"
                value={CATEGORY_LABELS[req.category] ?? req.category}
              />
              <MetaRow
                label="Priority"
                value={PRIORITY_LABELS[req.priority as keyof typeof PRIORITY_LABELS] ?? req.priority}
              />
              <MetaRow
                label="Submitted"
                value={new Date(req.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              {req.assignedTo && (
                <MetaRow label="Assigned to" value={req.assignedTo} />
              )}
            </div>

            <div className="mt-6 border-t border-border/50 pt-6">
              <p className="eyebrow-label">Description</p>
              <p className="mt-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {req.description}
              </p>
            </div>
          </section>

          {/* ── Status timeline ────────────────────────────────────────────── */}
          <StatusTimeline status={req.status} />

          {/* ── Manager actions panel ──────────────────────────────────────── */}
          {!isTerminal && (
            <section className="app-panel overflow-hidden p-6 md:p-8">
              <p className="eyebrow-label">Actions</p>

              {/* Assign contractor */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Assign contractor
                </p>
                <div className="flex gap-2">
                  <Input
                    className="h-11 max-w-sm rounded-xl bg-background"
                    placeholder="Contractor name or company"
                    value={assignInput}
                    onChange={(e) => setAssignInput(e.target.value)}
                  />
                  <Button
                    className="h-11 rounded-xl"
                    disabled={!assignInput.trim() || assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({ id, assignedTo: assignInput.trim() })
                    }
                  >
                    {assignMutation.isPending ? "Assigning…" : "Assign"}
                  </Button>
                </div>
              </div>

              {/* Status transitions */}
              {nextStatuses.length > 0 && (
                <div className="mt-6 border-t border-border/50 pt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Move to
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((next) => (
                      <Button
                        key={next}
                        variant="outline"
                        size="sm"
                        className={`h-9 rounded-xl text-xs ${
                          next === "CANCELLED"
                            ? "border-red-200 text-red-700 hover:bg-red-50"
                            : next === "COMPLETED" || next === "CLOSED"
                            ? "border-green-200 text-green-700 hover:bg-green-50"
                            : ""
                        }`}
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id,
                            status: next as Parameters<
                              typeof updateStatusMutation.mutate
                            >[0]["status"],
                          })
                        }
                      >
                        {STATUS_LABELS[next] ?? next}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Comments panel ─────────────────────────────────────────────── */}
          <section className="app-panel overflow-hidden p-6 md:p-8">
            <p className="eyebrow-label">Updates ({req.comments.length})</p>

            <div className="mt-4 space-y-3">
              {req.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No updates yet.</p>
              ) : (
                req.comments.map((c) => {
                  const initials =
                    `${c.user.firstName?.[0] ?? ""}${c.user.lastName?.[0] ?? ""}`.toUpperCase() ||
                    "?";
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
                    >
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, oklch(0.58 0.11 195), oklch(0.39 0.06 245))",
                          }}
                        >
                          {initials}
                        </div>
                        <p className="flex-1 text-xs font-medium text-foreground">
                          {c.user.firstName} {c.user.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {c.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 border-t border-border/50 pt-5">
              <label
                htmlFor="new-comment"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Add a comment
              </label>
              <Textarea
                id="new-comment"
                className="min-h-20 rounded-xl bg-background"
                placeholder="Add a note or update for the resident…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={!comment.trim() || addComment.isPending}
                  onClick={() =>
                    addComment.mutate({ maintenanceRequestId: id, content: comment.trim() })
                  }
                >
                  {addComment.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Photos panel ───────────────────────────────────────────────── */}
          <section className="app-panel overflow-hidden p-6 md:p-8">
            <div className="flex items-center justify-between">
              <p className="eyebrow-label">Photos ({req.images.length})</p>
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
                  disabled={uploading || addImageMutation.isPending || !!pendingFile}
                >
                  <Upload className="mr-1.5 h-3 w-3" />
                  Add Photo
                </Button>
              </div>
            </div>

            {pendingFile && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ready to upload
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={pendingFile.previewUrl}
                    alt="Preview"
                    className="h-20 w-20 shrink-0 rounded-lg border border-border/60 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {pendingFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(pendingFile.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={uploading || addImageMutation.isPending}
                        onClick={confirmUpload}
                      >
                        {uploading ? "Uploading…" : "Upload"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        disabled={uploading}
                        onClick={cancelPendingFile}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              {req.images.length === 0 ? (
                !pendingFile && (
                  <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    No photos attached. Add one to help document the issue.
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {req.images.map((img) => (
                    <div
                      key={img.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30"
                    >
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
                        className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow group-hover:flex"
                        onClick={() => deleteImageMutation.mutate({ id: img.id })}
                        disabled={deleteImageMutation.isPending}
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {img.caption && (
                        <p className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white">
                          {img.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
