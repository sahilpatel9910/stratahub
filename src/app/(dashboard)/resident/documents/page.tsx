"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResidentDocumentsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const downloadMutation = trpc.documents.getDownloadUrl.useMutation();

  const { data: documents = [], isLoading } = trpc.resident.getMyDocuments.useQuery(
    categoryFilter !== "ALL"
      ? { category: categoryFilter as "OTHER" }
      : {}
  );

  async function handleDownload(documentId: string) {
    const result = await downloadMutation.mutateAsync({ id: documentId });
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl font-bold">Building Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Public documents shared by building management
        </p>
      </div>

      <div className="w-48">
        <Select value={categoryFilter} onValueChange={(v) => v !== null && setCategoryFilter(v)} itemToStringLabel={(v) => v === "ALL" ? "All Categories" : CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? String(v)}>
          <SelectTrigger className="w-full rounded-xl bg-background"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" label="All Categories">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No documents available</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {CATEGORY_LABELS[doc.category] ?? doc.category}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString("en-AU")}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Download document ${doc.title}`}
                      onClick={() => handleDownload(doc.id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
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
