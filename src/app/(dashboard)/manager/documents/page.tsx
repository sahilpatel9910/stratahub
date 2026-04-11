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

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormCategory("OTHER");
    setFormIsPublic("false");
    setSelectedFile(null);
    setUploadProgress("idle");
  }

  function handleFileSelect(file: File) {
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
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [formTitle]
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

      const { signedUrl, path, publicUrl } = await urlRes.json() as {
        signedUrl: string;
        path: string;
        publicUrl: string;
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
        fileUrl: publicUrl,
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

  async function handleDelete(doc: { id: string; storagePath?: string | null }) {
    // Delete from storage if we have the path
    if (doc.storagePath) {
      await fetch("/api/storage/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.storagePath }),
      }).catch(() => null); // non-fatal — DB record is the source of truth
    }
    deleteMutation.mutate({ id: doc.id });
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a file and attach it to this building
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Dropzone */}
              <div
                className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : selectedFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
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
                  <div className="flex items-center justify-center gap-3">
                    <File className="h-8 w-8 text-green-600 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      className="ml-auto p-1 rounded hover:bg-green-100"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Drop a file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, images — max 50 MB
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="docTitle">Title *</Label>
                <Input
                  id="docTitle"
                  placeholder="e.g. Building Rules 2024"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docDesc">Description</Label>
                <Textarea
                  id="docDesc"
                  rows={2}
                  placeholder="Brief description..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={(v) => { if (v) setFormCategory(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={formIsPublic} onValueChange={(v) => { if (v) setFormIsPublic(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false" label="Staff only">Staff only</SelectItem>
                      <SelectItem value="true" label="Public (residents)">Public (residents)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {uploadProgress === "uploading" && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Uploading file...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadAndSave}
                disabled={!formTitle.trim() || !selectedFile || isSubmitting}
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
            <Select value={categoryFilter} onValueChange={(v) => { if (v) setCategoryFilter(v); }}>
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
                              className="h-8 w-8"
                              render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" />}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
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
