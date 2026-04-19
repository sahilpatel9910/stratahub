"use client";

import { useState, useRef, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Trash2, FileText, ExternalLink, Upload, X, File } from "lucide-react";
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

const CATEGORY_LABELS: Record<string, string> = {
  LEASE_AGREEMENT: "Lease Agreement",
  BUILDING_RULES: "Building Rules",
  STRATA_MINUTES: "Strata Minutes",
  FINANCIAL_REPORT: "Financial Report",
  INSURANCE: "Insurance",
  COMPLIANCE: "Compliance",
  NOTICE: "Notice",
  OTHER: "Other",
};

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [string, string][];

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
];

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DocCategory =
  | "LEASE_AGREEMENT"
  | "BUILDING_RULES"
  | "STRATA_MINUTES"
  | "FINANCIAL_REPORT"
  | "INSURANCE"
  | "COMPLIANCE"
  | "NOTICE"
  | "OTHER";

export default function DocumentsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("OTHER");
  const [formIsPublic, setFormIsPublic] = useState("false");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const query = trpc.documents.listByBuilding.useQuery(
    selectedBuildingId
      ? {
          buildingId: selectedBuildingId,
          category: categoryFilter !== "all" ? (categoryFilter as DocCategory) : undefined,
        }
      : skipToken
  );

  const createMutation = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.listByBuilding.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(err.message ?? "Failed to save document"),
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.listByBuilding.invalidate();
      toast.success("Document deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete document"),
  });
  const downloadMutation = trpc.documents.getDownloadUrl.useMutation({
    onError: (err) => toast.error(err.message ?? "Failed to open document"),
  });

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormCategory("OTHER");
    setFormIsPublic("false");
    setSelectedFile(null);
    setUploadProgress("idle");
  }

  const handleFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please upload PDF, Word, Excel, image, or text files.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 50 MB.");
      return;
    }
    setSelectedFile(file);
    // Auto-fill title from filename if empty
    if (!formTitle) {
      setFormTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }, [formTitle]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  async function handleUploadAndSave() {
    if (!selectedBuildingId || !formTitle.trim() || !selectedFile) return;

    setUploadProgress("uploading");

    try {
      // 1. Get signed upload URL from our API
      const urlRes = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type,
          buildingId: selectedBuildingId,
        }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to get upload URL");
      }

      const { signedUrl, path } = await urlRes.json() as {
        signedUrl: string;
        path: string;
      };

      // 2. Upload file directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error("File upload failed");
      }

      setUploadProgress("done");

      // 3. Save document record via tRPC
      createMutation.mutate({
        buildingId: selectedBuildingId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory as DocCategory,
        storagePath: path,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        isPublic: formIsPublic === "true",
      });
    } catch (err) {
      setUploadProgress("idle");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleDelete(doc: { id: string }) {
    deleteMutation.mutate({ id: doc.id });
  }

  async function handleOpenDocument(documentId: string) {
    const result = await downloadMutation.mutateAsync({ id: documentId });
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const documents = query.data ?? [];
  const isSubmitting = uploadProgress === "uploading" || createMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Store and manage building documents and files
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
            Upload Document
          </DialogTrigger>
          <DialogContent className="max-w-lg p-0">
            <DialogHeader>
              <DialogTitle className="px-0 pt-0">Upload Document</DialogTitle>
              <DialogDescription className="px-0">
                Upload a file and attach it to this building
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-7 py-5">
              <div className="space-y-6">
              {/* Dropzone */}
              <div
                className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/80"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/80"
                    : "border-border bg-muted/20 hover:border-foreground/20 hover:bg-muted/35"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center gap-3 rounded-xl bg-background/80 p-4 text-left">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <File className="h-6 w-6" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-medium text-base truncate">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove selected file"
                      className="ml-auto rounded-full p-2 text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Drop a file here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF, Word, Excel, images — max 50 MB
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                <Label htmlFor="docTitle">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="docTitle"
                  placeholder="e.g. Building Rules 2024"
                  className="h-12 rounded-xl"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="docDesc">Description</Label>
                <Textarea
                  id="docDesc"
                  rows={4}
                  className="min-h-32 rounded-xl"
                  placeholder="Brief description..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Access
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose how this file is grouped and whether residents can open it from their portal.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={(v) => { if (v) setFormCategory(v); }} itemToStringLabel={(v) => CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? String(v)}>
                    <SelectTrigger className="h-12 w-full rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Visibility</Label>
                  <Select value={formIsPublic} onValueChange={(v) => { if (v) setFormIsPublic(v); }} itemToStringLabel={(v) => v === "true" ? "Public (residents)" : "Staff only"}>
                    <SelectTrigger className="h-12 w-full rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false" label="Staff only">Staff only</SelectItem>
                      <SelectItem value="true" label="Public (residents)">Public (residents)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  </div>
                </div>
              </div>

              {uploadProgress === "uploading" && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Uploading file...
                </div>
              )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isSubmitting}
                className="h-11 rounded-xl px-5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadAndSave}
                disabled={!formTitle.trim() || !selectedFile || isSubmitting}
                className="h-11 rounded-xl px-5"
              >
                {isSubmitting ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view documents.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">Filter by category</Label>
            <Select value={categoryFilter} onValueChange={(v) => { if (v) setCategoryFilter(v); }} itemToStringLabel={(v) => v === "all" ? "All Categories" : CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? String(v)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All Categories">All Categories</SelectItem>
                {CATEGORIES.map(([v, l]) => (
                  <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 mb-2 text-muted-foreground/40" />
                        No documents found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground">{doc.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[doc.category] ?? doc.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {doc.isPublic ? "Public" : "Staff only"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Open document ${doc.title}`}
                              className="h-8 w-8"
                              onClick={() => handleOpenDocument(doc.id)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete document ${doc.title}`}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              disabled={deleteMutation.isPending}
                              onClick={() => handleDelete(doc)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
