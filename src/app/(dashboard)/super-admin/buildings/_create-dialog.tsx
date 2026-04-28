"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  DialogTrigger,
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

type Org = { id: string; name: string };

export default function CreateBuildingDialog({ orgs }: { orgs: Org[] }) {
  const [open, setOpen] = useState(false);
  const [formOrgId, setFormOrgId] = useState("");
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSuburb, setFormSuburb] = useState("");
  const [formState, setFormState] = useState<AustralianStateValue | "">("");
  const [formPostcode, setFormPostcode] = useState("");
  const [formFloors, setFormFloors] = useState("");
  const [formUnits, setFormUnits] = useState("");
  const [formStrataNo, setFormStrataNo] = useState("");

  const utils = trpc.useUtils();

  function resetForm() {
    setFormOrgId("");
    setFormName("");
    setFormAddress("");
    setFormSuburb("");
    setFormState("");
    setFormPostcode("");
    setFormFloors("");
    setFormUnits("");
    setFormStrataNo("");
  }

  const createMutation = trpc.buildings.create.useMutation({
    onSuccess: () => {
      utils.buildings.list.invalidate();
      setOpen(false);
      resetForm();
      toast.success("Building created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create building"),
  });

  function handleCreate() {
    if (
      !formOrgId ||
      !formName.trim() ||
      !formAddress.trim() ||
      !formSuburb.trim() ||
      !formState ||
      !formPostcode.trim() ||
      !formFloors ||
      !formUnits
    )
      return;

    createMutation.mutate({
      organisationId: formOrgId,
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        New Building
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Building</DialogTitle>
          <DialogDescription>
            Add a new building to an organisation
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 px-7 py-6">
          <div className="flex flex-col gap-1.5">
            <Label>
              Organisation <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formOrgId}
              onValueChange={(v) => {
                if (v) setFormOrgId(v);
              }}
              itemToStringLabel={(v) =>
                orgs.find((o) => o.id === v)?.name ?? String(v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id} label={org.name}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bName">
              Building Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bName"
              placeholder="e.g. Harbour View Apartments"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bAddress">
              Street Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bAddress"
              placeholder="e.g. 123 Main Street"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bSuburb">
                Suburb <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bSuburb"
                placeholder="e.g. Sydney"
                value={formSuburb}
                onChange={(e) => setFormSuburb(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bPostcode">
                Postcode <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bPostcode"
                placeholder="2000"
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
              <Label htmlFor="bFloors">
                Total Floors <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bFloors"
                type="number"
                min="1"
                placeholder="e.g. 12"
                value={formFloors}
                onChange={(e) => setFormFloors(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bUnits">
                Total Units <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bUnits"
                type="number"
                min="1"
                placeholder="e.g. 48"
                value={formUnits}
                onChange={(e) => setFormUnits(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bStrata">
              Strata Scheme No.{" "}
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="bStrata"
              placeholder="e.g. SP 12345"
              value={formStrataNo}
              onChange={(e) => setFormStrataNo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !formOrgId ||
              !formName.trim() ||
              !formAddress.trim() ||
              !formSuburb.trim() ||
              !formState ||
              !formPostcode.trim() ||
              !formFloors ||
              !formUnits ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? "Creating..." : "Create Building"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
