"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AUSTRALIAN_STATES } from "@/lib/constants";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type AustralianStateValue = (typeof AUSTRALIAN_STATES)[number]["value"];

export type BuildingForEdit = {
  id: string;
  organisationId: string;
  name: string;
  address: string;
  suburb: string;
  state: AustralianStateValue;
  postcode: string;
  totalFloors: number;
  totalUnits: number;
  strataSchemeNo: string | null;
  orgName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building: BuildingForEdit | null;
};

export default function EditBuildingDialog({ open, onOpenChange, building }: Props) {
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSuburb, setFormSuburb] = useState("");
  const [formState, setFormState] = useState<AustralianStateValue | "">("");
  const [formPostcode, setFormPostcode] = useState("");
  const [formFloors, setFormFloors] = useState("");
  const [formUnits, setFormUnits] = useState("");
  const [formStrataNo, setFormStrataNo] = useState("");

  const utils = trpc.useUtils();

  useEffect(() => {
    if (building) {
      setFormName(building.name);
      setFormAddress(building.address);
      setFormSuburb(building.suburb);
      setFormState(building.state);
      setFormPostcode(building.postcode);
      setFormFloors(String(building.totalFloors));
      setFormUnits(String(building.totalUnits));
      setFormStrataNo(building.strataSchemeNo ?? "");
    }
  }, [building]);

  const updateMutation = trpc.buildings.update.useMutation({
    onSuccess: () => {
      utils.buildings.list.invalidate();
      onOpenChange(false);
      toast.success("Building updated");
    },
    onError: (err) => toast.error(err.message ?? "Failed to update building"),
  });

  function handleEdit() {
    if (
      !building ||
      !formName.trim() ||
      !formAddress.trim() ||
      !formSuburb.trim() ||
      !formState ||
      !formPostcode.trim() ||
      !formFloors ||
      !formUnits
    )
      return;

    updateMutation.mutate({
      id: building.id,
      name: formName.trim(),
      address: formAddress.trim(),
      suburb: formSuburb.trim(),
      state: formState,
      postcode: formPostcode.trim(),
      totalFloors: parseInt(formFloors),
      totalUnits: parseInt(formUnits),
      strataSchemeNo: formStrataNo.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Building</DialogTitle>
          <DialogDescription>Update building details</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-7 py-6">
          <div className="flex flex-col gap-1.5">
            <Label>Organisation</Label>
            <Input value={building?.orgName ?? "—"} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editBName">
              Building Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="editBName"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editBAddress">
              Street Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="editBAddress"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editBSuburb">
                Suburb <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editBSuburb"
                value={formSuburb}
                onChange={(e) => setFormSuburb(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editBPostcode">
                Postcode <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editBPostcode"
                maxLength={4}
                value={formPostcode}
                onChange={(e) => setFormPostcode(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>
              State <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formState}
              onValueChange={(v) => setFormState(v as AustralianStateValue)}
              itemToStringLabel={(v) =>
                AUSTRALIAN_STATES.find((s) => s.value === v)?.label ?? String(v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {AUSTRALIAN_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value} label={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editBFloors">
                Total Floors <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editBFloors"
                type="number"
                min="1"
                value={formFloors}
                onChange={(e) => setFormFloors(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editBUnits">
                Total Units <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editBUnits"
                type="number"
                min="1"
                value={formUnits}
                onChange={(e) => setFormUnits(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editBStrata">
              Strata Scheme No.{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="editBStrata"
              value={formStrataNo}
              onChange={(e) => setFormStrataNo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEdit}
            disabled={
              !formName.trim() ||
              !formAddress.trim() ||
              !formSuburb.trim() ||
              !formState ||
              !formPostcode.trim() ||
              !formFloors ||
              !formUnits ||
              updateMutation.isPending
            }
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
