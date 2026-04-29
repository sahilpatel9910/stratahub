"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle, Plus, Trash2, Upload, X, ImageIcon } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const ITEM_STATUS_ICONS = {
  PASS: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  FAIL: <XCircle className="h-4 w-4 text-red-600" />,
  NA: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

export default function InspectionDetailClient({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});

  const { data: insp, isLoading, isError } = trpc.inspection.getById.useQuery({ id });

  const invalidate = () => {
    void utils.inspection.getById.invalidate({ id });
    void utils.inspection.listByBuilding.invalidate();
  };

  const completeMutation = trpc.inspection.complete.useMutation({
    onSuccess: () => { toast.success("Inspection completed"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to complete"),
  });

  const addRoomMutation = trpc.inspection.addRoom.useMutation({
    onSuccess: () => { invalidate(); setNewRoomName(""); },
    onError: (e) => toast.error(e.message ?? "Failed to add room"),
  });

  const deleteRoomMutation = trpc.inspection.deleteRoom.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to delete room"),
  });

  const addItemMutation = trpc.inspection.addItem.useMutation({
    onSuccess: (_, vars) => {
      invalidate();
      setNewItemLabels((prev) => ({ ...prev, [vars.roomId]: "" }));
    },
    onError: (e) => toast.error(e.message ?? "Failed to add item"),
  });

  const updateItemMutation = trpc.inspection.updateItem.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to update item"),
  });

  const deleteItemMutation = trpc.inspection.deleteItem.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to delete item"),
  });

  const addImageMutation = trpc.inspection.addImage.useMutation({
    onSuccess: () => { toast.success("Photo added"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to add photo"),
  });

  const deleteImageMutation = trpc.inspection.deleteImage.useMutation({
    onSuccess: () => { toast.success("Photo removed"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to remove photo"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Select an image file"); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); e.target.value = ""; return; }
    setPendingFile({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  function cancelPendingFile() {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/inspection-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: pendingFile.file.name, contentType: pendingFile.file.type, inspectionId: id }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "Failed to get upload URL");
      const { signedUrl, path } = (await urlRes.json()) as { signedUrl: string; path: string };
      const uploadRes = await fetch(signedUrl, { method: "PUT", body: pendingFile.file, headers: { "Content-Type": pendingFile.file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");
      await addImageMutation.mutateAsync({ inspectionId: id, storagePath: path });
      cancelPendingFile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
      cancelPendingFile();
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="mt-4 h-5 w-48 rounded-full" />
      </section>
    </div>
  );

  if (isError || !insp) return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <p className="text-sm text-muted-foreground">Could not load inspection.</p>
        <Link href="/manager/inspections" className="mt-3 inline-flex text-sm text-muted-foreground hover:text-foreground">← Inspections</Link>
      </section>
    </div>
  );

  const isCompleted = insp.status === "COMPLETED";
  const isCancelled = insp.status === "CANCELLED";
  const isEditable = !isCompleted && !isCancelled;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <Link href="/manager/inspections" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Inspections
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label text-primary/80">Inspection</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Unit {insp.unit.unitNumber} — {TYPE_LABELS[insp.type] ?? insp.type}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {insp.unit.building.name}{insp.unit.building.suburb ? `, ${insp.unit.building.suburb}` : ""} ·{" "}
              {new Date(insp.scheduledAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {isEditable && (
            <Button
              className="mt-3 h-10 rounded-xl bg-green-600 hover:bg-green-700"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate({ id })}
            >
              {completeMutation.isPending ? "Completing…" : "Mark Complete"}
            </Button>
          )}
        </div>
        {isCompleted && <Badge className="mt-4 bg-green-100 text-green-800">Completed {insp.completedAt ? new Date(insp.completedAt).toLocaleDateString("en-AU") : ""}</Badge>}
        {isCancelled && <Badge className="mt-4 bg-gray-100 text-gray-600">Cancelled</Badge>}
      </section>

      {/* Condition report — rooms */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow-label">Condition Report</p>
        </div>

        {insp.rooms.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No rooms added yet. Add a room to start the report.</p>
        )}

        <div className="mt-4 space-y-6">
          {insp.rooms.map((room) => (
            <div key={room.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{room.name}</p>
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteRoomMutation.mutate({ id: room.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {room.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1">
                      {(["PASS", "FAIL", "NA"] as const).map((s) => (
                        <button
                          key={s}
                          disabled={!isEditable || updateItemMutation.isPending}
                          onClick={() => updateItemMutation.mutate({ id: item.id, status: s })}
                          className={`rounded p-1 transition-colors ${item.status === s ? "bg-accent" : "hover:bg-accent/50"}`}
                          title={s}
                        >
                          {ITEM_STATUS_ICONS[s]}
                        </button>
                      ))}
                    </div>
                    <p className="flex-1 text-sm text-foreground">{item.label}</p>
                    {isEditable && (
                      <button
                        onClick={() => deleteItemMutation.mutate({ id: item.id })}
                        className="text-muted-foreground hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isEditable && (
                <div className="mt-3 flex gap-2">
                  <Input
                    className="h-9 rounded-xl bg-background text-sm"
                    placeholder="Add item (e.g. Windows, Flooring)"
                    value={newItemLabels[room.id] ?? ""}
                    onChange={(e) => setNewItemLabels((prev) => ({ ...prev, [room.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (newItemLabels[room.id] ?? "").trim()) {
                        addItemMutation.mutate({ roomId: room.id, label: (newItemLabels[room.id] ?? "").trim() });
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={!(newItemLabels[room.id] ?? "").trim() || addItemMutation.isPending}
                    onClick={() => addItemMutation.mutate({ roomId: room.id, label: (newItemLabels[room.id] ?? "").trim() })}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isEditable && (
          <div className="mt-5 flex gap-2 border-t border-border/50 pt-5">
            <Input
              className="h-10 max-w-xs rounded-xl bg-background"
              placeholder="Room name (e.g. Kitchen, Bathroom 1)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRoomName.trim()) {
                  addRoomMutation.mutate({ inspectionId: id, name: newRoomName.trim(), order: insp.rooms.length });
                }
              }}
            />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={!newRoomName.trim() || addRoomMutation.isPending}
              onClick={() => addRoomMutation.mutate({ inspectionId: id, name: newRoomName.trim(), order: insp.rooms.length })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Room
            </Button>
          </div>
        )}
      </section>

      {/* Photos */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow-label">Photos ({insp.images.length})</p>
          {isEditable && (
            <div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
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
          )}
        </div>

        {pendingFile && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-3">
              <img src={pendingFile.previewUrl} alt="Preview" className="h-20 w-20 rounded-lg border object-cover" />
              <div className="flex-1">
                <p className="truncate text-sm font-medium">{pendingFile.file.name}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="h-8 rounded-lg text-xs" disabled={uploading} onClick={confirmUpload}>
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={uploading} onClick={cancelPendingFile}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {insp.images.length === 0 && !pendingFile ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-30" />
              No photos yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {insp.images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                  {img.displayUrl ? (
                    <img src={img.displayUrl} alt={img.caption ?? "Inspection photo"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  {isEditable && (
                    <button
                      className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow group-hover:flex"
                      onClick={() => deleteImageMutation.mutate({ id: img.id })}
                      disabled={deleteImageMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
