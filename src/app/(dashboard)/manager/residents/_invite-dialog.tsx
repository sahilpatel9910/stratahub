"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
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
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type InviteRole = "OWNER" | "TENANT";
type Unit = { id: string; unitNumber: string };

function getAppUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBuildingId: string | null;
  units: Unit[];
};

export default function InviteResidentDialog({
  open,
  onOpenChange,
  selectedBuildingId,
  units,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("TENANT");
  const [inviteUnitId, setInviteUnitId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  function resetForm() {
    setInviteEmail("");
    setInviteRole("TENANT");
    setInviteUnitId("");
    setInviteLink("");
    setCopied(false);
  }

  const inviteMutation = trpc.users.createManagerInvite.useMutation({
    onSuccess: (invite) => {
      setInviteLink(`${getAppUrl()}/invite/${invite.token}`);
      utils.residents.listByBuilding.invalidate();
      toast.success("Resident invite created");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create invite"),
  });

  function handleInvite() {
    if (!selectedBuildingId || !inviteEmail.trim() || !inviteUnitId) return;
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      buildingId: selectedBuildingId,
      unitId: inviteUnitId,
      role: inviteRole,
    });
  }

  async function handleCopyInviteLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="max-w-lg p-0">
        <DialogHeader>
          <DialogTitle className="px-0 pt-0">Invite Resident</DialogTitle>
          <DialogDescription className="px-0">
            Send an invite for an owner or tenant in the selected building.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inviteEmail">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  className="h-12 rounded-xl"
                  placeholder="resident@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) =>
                    value !== null && setInviteRole(value as InviteRole)
                  }
                  itemToStringLabel={(value) =>
                    value === "OWNER"
                      ? "Owner"
                      : value === "TENANT"
                        ? "Tenant"
                        : String(value)
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TENANT" label="Tenant">
                      Tenant
                    </SelectItem>
                    <SelectItem value="OWNER" label="Owner">
                      Owner
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={inviteUnitId}
                  onValueChange={(value) =>
                    value !== null && setInviteUnitId(value)
                  }
                  itemToStringLabel={(value) => {
                    const unit = units.find((item) => item.id === value);
                    return unit ? `Unit ${unit.unitNumber}` : String(value);
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem
                        key={unit.id}
                        value={unit.id}
                        label={`Unit ${unit.unitNumber}`}
                      >
                        Unit {unit.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteLink && (
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-sm font-medium text-foreground">
                    Invite link ready
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="block flex-1 truncate rounded-xl bg-background px-3 py-2 text-xs">
                      {inviteLink}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl"
                      onClick={handleCopyInviteLink}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Invite scope
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Building managers can invite residents only into the currently
                selected building, only as an owner or tenant, and only for a
                specific unit.
              </p>
              <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What happens next</p>
                <p className="mt-2 leading-6">
                  Once the invite is accepted, the user will be linked to this
                  building and unit. Owner invites create ownership immediately;
                  tenant invites create an active tenancy placeholder that
                  should be reviewed in Units or Rent.
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={inviteMutation.isPending}
            className="h-11 rounded-xl px-5"
          >
            Close
          </Button>
          <Button
            onClick={handleInvite}
            disabled={
              !inviteEmail.trim() || !inviteUnitId || inviteMutation.isPending
            }
            className="h-11 rounded-xl px-5"
          >
            {inviteMutation.isPending ? "Creating..." : "Create Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
