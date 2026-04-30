"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { UserPlus } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { useBuildingContext } from "@/hooks/use-building-context";

export default function CreateTenancyDialog() {
  const [open, setOpen] = useState(false);
  const { selectedBuildingId } = useBuildingContext();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    unitId: "",
    userId: "",
    leaseStartDate: "",
    leaseEndDate: "",
    rentAmountCents: "",
    rentFrequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
    bondAmountCents: "",
    scheduleMonths: "12",
  });

  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );
  const residentsQuery = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.tenancy.create.useMutation({
    onSuccess: () => {
      toast.success("Tenancy created");
      void utils.tenancy.listByBuilding.invalidate();
      void utils.rent.getRentRoll.invalidate();
      void utils.rent.listByBuilding.invalidate();
      setOpen(false);
      setForm({
        unitId: "", userId: "", leaseStartDate: "", leaseEndDate: "",
        rentAmountCents: "", rentFrequency: "MONTHLY", bondAmountCents: "",
        scheduleMonths: "12",
      });
    },
    onError: (e) => toast.error(e.message ?? "Failed to create tenancy"),
  });

  const units = unitsQuery.data ?? [];
  const residents = residentsQuery.data ?? [];

  const canSubmit =
    form.unitId && form.userId && form.leaseStartDate &&
    form.rentAmountCents && form.bondAmountCents && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9 rounded-xl">
            <UserPlus className="mr-1.5 h-4 w-4" />
            New Tenancy
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Tenancy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-7 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={form.unitId}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, unitId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Select
                value={form.userId}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, userId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select resident" />
                </SelectTrigger>
                <SelectContent>
                  {residents.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.firstName} {r.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lease start</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseStartDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lease end (optional)</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseEndDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseEndDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rent amount (cents)</Label>
              <Input
                type="number"
                placeholder="e.g. 150000 for $1,500"
                className="rounded-xl"
                value={form.rentAmountCents}
                onChange={(e) => setForm((f) => ({ ...f, rentAmountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.rentFrequency}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, rentFrequency: v as typeof form.rentFrequency }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bond amount (cents)</Label>
              <Input
                type="number"
                placeholder="e.g. 450000 for $4,500"
                className="rounded-xl"
                value={form.bondAmountCents}
                onChange={(e) => setForm((f) => ({ ...f, bondAmountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Schedule months</Label>
              <Input
                type="number"
                min={1}
                max={24}
                className="rounded-xl"
                value={form.scheduleMonths}
                onChange={(e) => setForm((f) => ({ ...f, scheduleMonths: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              createMutation.mutate({
                unitId: form.unitId,
                userId: form.userId,
                leaseStartDate: form.leaseStartDate,
                leaseEndDate: form.leaseEndDate || null,
                rentAmountCents: parseInt(form.rentAmountCents, 10),
                rentFrequency: form.rentFrequency,
                bondAmountCents: parseInt(form.bondAmountCents, 10),
                generateSchedule: true,
                scheduleMonths: parseInt(form.scheduleMonths, 10),
              })
            }
          >
            {createMutation.isPending ? "Creating…" : "Create Tenancy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
