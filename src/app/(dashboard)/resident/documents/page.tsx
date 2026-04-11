"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const { data: documents = [], isLoading } = trpc.resident.getMyDocuments.useQuery(
    categoryFilter !== "ALL"
      ? { category: categoryFilter as "OTHER" }
      : {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Building Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Public documents shared by building management
        </p>
      </div>

      <div className="w-48">
        <Select value={categoryFilter} onValueChange={(v) => v !== null && setCategoryFilter(v)}>
          <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No documents available</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Uploaded By</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CATEGORY_LABELS[doc.category] ?? doc.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download />}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
