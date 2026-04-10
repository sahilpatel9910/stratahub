"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";

const INCOME_CATEGORIES = [
  "Strata Levy",
  "Admin Fund",
  "Capital Works Levy",
  "Special Levy",
  "Insurance Claim",
  "Interest",
  "Other Income",
];

const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Insurance",
  "Utilities",
  "Management Fees",
  "Legal",
  "Audit",
  "Cleaning",
  "Landscaping",
  "Repairs",
  "Other Expense",
];

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FinancialsPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [tab, setTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const [formType, setFormType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  const utils = trpc.useUtils();

  const typeFilter =
    tab === "income" ? "INCOME" : tab === "expense" ? "EXPENSE" : undefined;

  const query = trpc.financials.listByBuilding.useQuery(
    selectedBuildingId
      ? { buildingId: selectedBuildingId, type: typeFilter }
      : skipToken
  );

  const summaryQuery = trpc.financials.getSummary.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.financials.create.useMutation({
    onSuccess: () => {
      utils.financials.listByBuilding.invalidate();
      utils.financials.getSummary.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("Record added");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add record"),
  });

  const deleteMutation = trpc.financials.delete.useMutation({
    onSuccess: () => {
      utils.financials.listByBuilding.invalidate();
      utils.financials.getSummary.invalidate();
      toast.success("Record deleted");
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete record"),
  });

  function resetForm() {
    setFormType("INCOME");
    setFormCategory("");
    setFormDescription("");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
  }

  function handleCreate() {
    if (!selectedBuildingId || !formCategory || !formDescription.trim() || !formAmount) return;
    const dollars = parseFloat(formAmount);
    if (isNaN(dollars) || dollars <= 0) return;

    createMutation.mutate({
      buildingId: selectedBuildingId,
      type: formType,
      category: formCategory,
      description: formDescription.trim(),
      amountCents: Math.round(dollars * 100),
      date: formDate,
    });
  }

  const categories = formType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const records = query.data ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financials</h1>
          <p className="text-muted-foreground">
            Track income and expenses for the building
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
            Add Record
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Financial Record</DialogTitle>
              <DialogDescription>
                Record an income or expense transaction
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => {
                    setFormType(v as "INCOME" | "EXPENSE");
                    setFormCategory("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formCategory} onValueChange={(v) => { if (v) setFormCategory(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finDesc">Description *</Label>
                <Input
                  id="finDesc"
                  placeholder="e.g. Q1 strata levy collection"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="finAmount">Amount (AUD) *</Label>
                  <Input
                    id="finAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finDate">Date *</Label>
                  <Input
                    id="finDate"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
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
                  !formCategory ||
                  !formDescription.trim() ||
                  !formAmount ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Saving..." : "Add Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view financials.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary?.totalIncome ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary?.totalExpense ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Position
                </CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-7 w-28" />
                ) : (
                  <p
                    className={`text-2xl font-bold ${
                      (summary?.net ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(summary?.net ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Records table */}
          <Card>
            <CardContent className="p-0">
              <Tabs value={tab} onValueChange={setTab}>
                <div className="px-4 pt-4">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="income">Income</TabsTrigger>
                    <TabsTrigger value="expense">Expenses</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value={tab} className="mt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {query.isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-4 w-20" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : records.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-12 text-center text-muted-foreground"
                          >
                            No financial records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        records.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(rec.date)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  rec.type === "INCOME"
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : "bg-red-100 text-red-800 hover:bg-red-100"
                                }
                              >
                                {rec.type === "INCOME" ? "Income" : "Expense"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {rec.category}
                            </TableCell>
                            <TableCell className="text-sm">
                              {rec.description}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                rec.type === "INCOME"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {rec.type === "EXPENSE" ? "−" : "+"}
                              {formatCurrency(rec.amountCents)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                disabled={deleteMutation.isPending}
                                onClick={() =>
                                  deleteMutation.mutate({ id: rec.id })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
