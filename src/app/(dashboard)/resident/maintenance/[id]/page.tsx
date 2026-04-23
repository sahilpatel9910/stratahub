"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, X } from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS as PRIORITY_LABELS_CONST,
  CATEGORY_LABELS,
} from "@/lib/constants";

const PRIORITY_LABELS: Record<string, string> = PRIORITY_LABELS_CONST;

// ─── Timeline steps (canonical order) ────────────────────────────────────────

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
  const idx = TIMELINE_STEPS.indexOf(status as TimelineStep);
  return idx; // -1 if terminal (CLOSED / CANCELLED)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="eyebrow-label">
      {children}
    </p>
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

// ─── Status timeline ──────────────────────────────────────────────────────────

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  const isTerminal = currentIdx === -1; // CLOSED or CANCELLED

  return (
    <section className="app-panel overflow-hidden p-6 md:p-8">
      <SectionLabel>Status</SectionLabel>

      <div className="mt-6">
        {/* Main step row */}
        <div className="flex items-start">
          {TIMELINE_STEPS.map((step, i) => {
            const isFilled = !isTerminal && i <= currentIdx;
            const isCurrent = !isTerminal && i === currentIdx;
            const isLast = i === TIMELINE_STEPS.length - 1;

            return (
              <div key={step} className="flex flex-1 flex-col items-center">
                {/* Circle + connector row */}
                <div className="flex w-full items-center">
                  {/* Left connector */}
                  {i > 0 && (
                    <div
                      className={`flex-1 h-px transition-colors ${
                        isFilled ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}

                  {/* Circle */}
                  <div
                    className={`
                      relative flex items-center justify-center rounded-full transition-all
                      ${isCurrent ? "h-5 w-5" : "h-3.5 w-3.5"}
                      ${
                        isFilled
                          ? "bg-primary"
                          : "border-2 border-border bg-background"
                      }
                    `}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-2" />
                    )}
                    {isFilled && !isCurrent && (
                      /* small filled dot inner */
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>

                  {/* Right connector */}
                  {!isLast && (
                    <div
                      className={`flex-1 h-px transition-colors ${
                        !isTerminal && i < currentIdx
                          ? "bg-primary"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>

                {/* Label below */}
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

        {/* Terminal state indicator (CLOSED / CANCELLED) */}
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

// ─── Skeleton rows ────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: req, isLoading, isError } = trpc.maintenance.getById.useQuery({ id });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
          maintenanceRequestId: id,
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
        maintenanceRequestId: id,
        storagePath: path,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* ── Header panel ───────────────────────────────────────────────────── */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        {/* Back link */}
        <Link
          href="/resident/maintenance"
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
          My Requests
        </Link>

        <p className="eyebrow-label text-primary/80">Resident Workspace</p>

        {isLoading ? (
          <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-muted" />
        ) : (
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
            {req?.title ?? "Request not found"}
          </h1>
        )}
      </section>

      {/* ── Loading state ──────────────────────────────────────────────────── */}
      {isLoading && (
        <>
          <SkeletonPanel />
          <SkeletonPanel />
        </>
      )}

      {/* ── Error / not found state ────────────────────────────────────────── */}
      {isError && (
        <section className="app-panel overflow-hidden p-6 md:p-8">
          <p className="text-sm text-muted-foreground">
            Could not load this maintenance request. It may not exist or you may
            not have permission to view it.
          </p>
          <Link
            href="/resident/maintenance"
            className="mt-3 inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to requests
          </Link>
        </section>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {req && !isLoading && (
        <>
          {/* Meta panel */}
          <section className="app-panel overflow-hidden p-6 md:p-8">
            {/* Top row: label + status badge */}
            <div className="flex items-center justify-between gap-4">
              <SectionLabel>Request details</SectionLabel>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {STATUS_LABELS[req.status] ?? req.status}
              </span>
            </div>

            {/* 2-column metadata grid */}
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <MetaRow label="Unit" value={`Unit ${req.unit.unitNumber}`} />
              <MetaRow label="Building" value={req.unit.building.name} />
              <MetaRow
                label="Category"
                value={CATEGORY_LABELS[req.category] ?? req.category}
              />
              <MetaRow
                label="Priority"
                value={PRIORITY_LABELS[req.priority] ?? req.priority}
              />
              <MetaRow
                label="Submitted"
                value={new Date(req.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>

            {/* Description */}
            <div className="mt-6 border-t border-border/50 pt-6">
              <SectionLabel>Description</SectionLabel>
              <p className="mt-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {req.description}
              </p>
            </div>
          </section>

          {/* Status timeline panel */}
          <StatusTimeline status={req.status} />

          {/* Photos panel */}
          <section className="app-panel overflow-hidden p-6 md:p-8">
            <div className="flex items-center justify-between">
              <SectionLabel>Photos ({req.images.length})</SectionLabel>
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

            <div className="mt-4">
              {req.images.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  No photos attached. Add one to help describe the issue.
                </div>
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
          </section>
        </>
      )}
    </div>
  );
}
