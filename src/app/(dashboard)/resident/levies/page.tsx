"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
  PARTIAL: "Partial",
  WAIVED: "Waived",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  WAIVED: "bg-gray-100 text-gray-800",
};

const LEVY_TYPE_LABELS: Record<string, string> = {
  ADMIN_FUND: "Admin Fund",
  CAPITAL_WORKS: "Capital Works",
  SPECIAL_LEVY: "Special Levy",
};

export default function ResidentLeviesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: levies = [], isLoading } = trpc.resident.getMyLevies.useQuery(
    statusFilter !== "ALL" ? { status: statusFilter as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED" } : {}
  );

  const unpaidTotal = levies
    .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.amountCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Levies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Strata levy history for your unit
          </p>
        </div>
        {unpaidTotal > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-right">
            <p className="text-xs text-orange-600 font-medium">Outstanding</p>
            <p className="text-lg font-bold text-orange-700">{formatCurrency(unpaidTotal)}</p>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="w-44">
        <Select
          value={statusFilter}
          onValueChange={(v) => v !== null && setStatusFilter(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="WAIVED">Waived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : levies.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No levies found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Quarter</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {levies.map((levy) => (
                <tr key={levy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{levy.unitNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {LEVY_TYPE_LABELS[levy.levyType] ?? levy.levyType}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(levy.quarterStart).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(levy.dueDate).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(levy.amountCents)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[levy.status] ?? ""}>
                      {STATUS_LABELS[levy.status] ?? levy.status}
                    </Badge>
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
