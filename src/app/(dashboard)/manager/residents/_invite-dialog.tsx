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

function getAppUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBuildingId: string | null;
};

export default function InviteResidentDialog({
  open,
  onOpenChange,
  selectedBuildingId,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("TENANT");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  function resetForm() {
    setFirstName("");
    setLastName("");
    setInviteEmail("");
    setInviteRole("TENANT");
    setInviteLink("");
    setCopied(false);
  }

  const inviteMutation = trpc.users.createManagerInvite.useMutation({
    onSuccess: (invite) => {
      setInviteLink(`${getAppUrl()}/invite/${invite.token}`);
      utils.residents.listByBuilding.invalidate();
      toast.success("Resident added — invite link ready to share");
    },
    onError: (err) => toast.error(err.message ?? "Failed to create invite"),
  });

  function handleInvite() {
    if (!selectedBuildingId || !firstName.trim() || !lastName.trim() || !inviteEmail.trim()) return;
    inviteMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: inviteEmail.trim(),
      buildingId: selectedBuildingId,
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
          <DialogTitle className="px-0 pt-0">Add Resident</DialogTitle>
          <DialogDescription className="px-0">
            Add an owner or tenant to the building roster. Unit assignment happens separately on the Units page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    className="h-12 rounded-xl"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    className="h-12 rounded-xl"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
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
                  The resident is added to the building roster immediately — they appear on the Residents page right away. Send them the invite link so they can activate their account. Once ready, assign them to a unit from the Units page to create the tenancy or ownership.
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
            disabled={!firstName.trim() || !lastName.trim() || !inviteEmail.trim() || inviteMutation.isPending}
            className="h-11 rounded-xl px-5"
          >
            {inviteMutation.isPending ? "Adding..." : "Add Resident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
