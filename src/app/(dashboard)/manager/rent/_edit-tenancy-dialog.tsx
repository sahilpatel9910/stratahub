"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TenancyForEdit = {
  id: string;
  leaseStartDate: Date | string;
  leaseEndDate?: Date | string | null;
  rentAmountCents: number;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  bondAmountCents: number;
};

interface Props {
  tenancy: TenancyForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDateInput(v: Date | string | null | undefined) {
  if (!v) return "";
  return new Date(v).toISOString().split("T")[0];
}

export default function EditTenancyDialog({ tenancy, open, onOpenChange }: Props) {
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    leaseStartDate: "",
    leaseEndDate: "",
    rentAmountCents: "",
    rentFrequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
    bondAmountCents: "",
  });

  useEffect(() => {
    if (tenancy) {
      setForm({
        leaseStartDate: toDateInput(tenancy.leaseStartDate),
        leaseEndDate: toDateInput(tenancy.leaseEndDate),
        rentAmountCents: String(tenancy.rentAmountCents),
        rentFrequency: tenancy.rentFrequency,
        bondAmountCents: String(tenancy.bondAmountCents),
      });
    }
  }, [tenancy?.id]);

  const updateMutation = trpc.tenancy.update.useMutation({
    onSuccess: () => {
      toast.success("Tenancy updated");
      void utils.tenancy.listByBuilding.invalidate();
      void utils.tenancy.getById.invalidate();
      void utils.rent.getRentRoll.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message ?? "Failed to update tenancy"),
  });

  if (!tenancy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lease Terms</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              <Label>Lease end</Label>
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
              <Label>Rent (cents)</Label>
              <Input
                type="number"
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
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bond (cents)</Label>
            <Input
              type="number"
              className="rounded-xl"
              value={form.bondAmountCents}
              onChange={(e) => setForm((f) => ({ ...f, bondAmountCents: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: tenancy.id,
                leaseStartDate: form.leaseStartDate,
                leaseEndDate: form.leaseEndDate || null,
                rentAmountCents: parseInt(form.rentAmountCents, 10),
                rentFrequency: form.rentFrequency,
                bondAmountCents: parseInt(form.bondAmountCents, 10),
              })
            }
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
