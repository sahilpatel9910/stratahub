"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function InspectionsClient() {
  const router = useRouter();
  const { selectedBuildingId } = useBuildingContext();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    unitId: "",
    type: "ROUTINE" as "ROUTINE" | "ENTRY" | "EXIT" | "EMERGENCY",
    scheduledAt: "",
    notes: "",
  });

  const query = trpc.inspection.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );
  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.inspection.create.useMutation({
    onSuccess: () => {
      toast.success("Inspection scheduled");
      void utils.inspection.listByBuilding.invalidate();
      setCreateOpen(false);
      setForm({ unitId: "", type: "ROUTINE", scheduledAt: "", notes: "" });
    },
    onError: (e) => toast.error(e.message ?? "Failed to schedule inspection"),
  });

  const cancelMutation = trpc.inspection.cancel.useMutation({
    onSuccess: () => {
      toast.success("Inspection cancelled");
      void utils.inspection.listByBuilding.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to cancel"),
  });

  const inspections = query.data ?? [];
  const units = unitsQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Inspections
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Schedule and manage property inspections with full condition reports.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="mt-6 h-10 rounded-xl"><Plus className="mr-1.5 h-4 w-4" />Schedule Inspection</Button>} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Inspection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 px-7 py-5">
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Select
                    value={form.unitId}
                    onValueChange={(v) => v !== null && setForm((f) => ({ ...f, unitId: v }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => v !== null && setForm((f) => ({ ...f, type: v as typeof form.type }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date &amp; time</Label>
                  <Input
                    type="datetime-local"
                    className="rounded-xl"
                    value={form.scheduledAt}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input
                    className="rounded-xl"
                    placeholder="Entry instructions, access code…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  disabled={!form.unitId || !form.scheduledAt || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      unitId: form.unitId,
                      type: form.type,
                      scheduledAt: form.scheduledAt,
                      notes: form.notes || undefined,
                    })
                  }
                >
                  {createMutation.isPending ? "Scheduling…" : "Schedule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : inspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No inspections yet. Schedule one to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              inspections.map((insp) => (
                <TableRow
                  key={insp.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/manager/inspections/${insp.id}`)}
                >
                  <TableCell className="font-medium">Unit {insp.unit.unitNumber}</TableCell>
                  <TableCell>{TYPE_LABELS[insp.type] ?? insp.type}</TableCell>
                  <TableCell>{formatDate(insp.scheduledAt)}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[insp.status] ?? ""}`}>
                      {insp.status.charAt(0) + insp.status.slice(1).toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{insp._count.rooms}</TableCell>
                  <TableCell>
                    {insp.status === "SCHEDULED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-red-600 hover:bg-red-50"
                        disabled={cancelMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Cancel this inspection?")) {
                            cancelMutation.mutate({ id: insp.id });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
