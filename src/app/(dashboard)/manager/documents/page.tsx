"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("OTHER");
  const [formFileUrl, setFormFileUrl] = useState("");
  const [formIsPublic, setFormIsPublic] = useState("false");

  const utils = trpc.useUtils();

  type DocCategory =
    | "LEASE_AGREEMENT"
    | "BUILDING_RULES"
    | "STRATA_MINUTES"
    | "FINANCIAL_REPORT"
    | "INSURANCE"
    | "COMPLIANCE"
    | "NOTICE"
    | "OTHER";

  const query = trpc.documents.listByBuilding.useQuery(
    selectedBuildingId
      ? {
          buildingId: selectedBuildingId,
          category:
            categoryFilter !== "all"
              ? (categoryFilter as DocCategory)
              : undefined,
        }
      : skipToken
  );

  const createMutation = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.listByBuilding.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Document added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add document"),
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
    setFormFileUrl("");
    setFormIsPublic("false");
  }

  function handleCreate() {
    if (!selectedBuildingId || !formTitle.trim() || !formFileUrl.trim()) return;
    createMutation.mutate({
      buildingId: selectedBuildingId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      category: formCategory as Parameters<typeof createMutation.mutate>[0]["category"],
      fileUrl: formFileUrl.trim(),
      fileSize: 0,
      mimeType: "application/octet-stream",
      isPublic: formIsPublic === "true",
    });
  }

  const documents = query.data ?? [];

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
          <DialogTrigger asChild>
            <Button disabled={!selectedBuildingId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
              <DialogDescription>
                Link a document to this building
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                  placeholder="Brief description of the document..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={(v) => { if (v) setFormCategory(v); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={formIsPublic} onValueChange={(v) => { if (v) setFormIsPublic(v); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Staff only</SelectItem>
                      <SelectItem value="true">Public (residents)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileUrl">File URL *</Label>
                <Input
                  id="fileUrl"
                  type="url"
                  placeholder="https://..."
                  value={formFileUrl}
                  onChange={(e) => setFormFileUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the URL of the file (e.g. from Supabase Storage or Google Drive)
                </p>
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
                  !formFileUrl.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Adding..." : "Add Document"}
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
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
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
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground"
                      >
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
                              <p className="text-xs text-muted-foreground">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[doc.category] ?? doc.category}
                          </Badge>
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
                              asChild
                            >
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              disabled={deleteMutation.isPending}
                              onClick={() =>
                                deleteMutation.mutate({ id: doc.id })
                              }
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
