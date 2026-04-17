"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Search, MoreHorizontal, Users, UserPlus, Link2, Copy, Check, RefreshCw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { USER_ROLE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { roleCanTargetBuilding, roleRequiresUnit } from "@/lib/auth/invite-scope";
import { getInvitationStatus, INVITATION_STATUS_LABELS, type InvitationStatus } from "@/lib/auth/invitations";

const INVITEABLE_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "BUILDING_MANAGER", label: "Building Manager" },
  { value: "RECEPTION", label: "Reception" },
  { value: "OWNER", label: "Owner" },
  { value: "TENANT", label: "Tenant" },
] as const;

const ASSIGNABLE_BUILDING_ROLES = INVITEABLE_ROLES.filter(
  (role) => role.value !== "SUPER_ADMIN"
);

type AssignableRole = (typeof INVITEABLE_ROLES)[number]["value"];
type AssignableBuildingRole = (typeof ASSIGNABLE_BUILDING_ROLES)[number]["value"];

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getAppUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getInvitationStatusBadge(status: InvitationStatus) {
  switch (status) {
    case "accepted":
      return {
        label: INVITATION_STATUS_LABELS.accepted,
        className: "border-green-200 bg-green-50 text-green-700",
      };
    case "revoked":
      return {
        label: INVITATION_STATUS_LABELS.revoked,
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    case "expired":
      return {
        label: INVITATION_STATUS_LABELS.expired,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "pending":
      return {
        label: INVITATION_STATUS_LABELS.pending,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      };
    default:
      return { label: "Unknown", className: "" };
  }
}

function getInviteScope(
  invite: { organisationId: string; buildingId?: string | null },
  orgs: { id: string; name: string }[],
  buildings: { id: string; name: string; suburb: string; organisationId: string }[]
) {
  const organisation = orgs.find((org) => org.id === invite.organisationId)?.name ?? "Unknown organisation";
  const building = invite.buildingId
    ? buildings.find((item) => item.id === invite.buildingId)
    : null;

  if (!building) {
    return organisation;
  }

  return `${organisation} • ${building.name}${building.suburb ? `, ${building.suburb}` : ""}`;
}

function getInviteStatusDetail(
  invite: { acceptedAt: Date | string | null; revokedAt?: Date | string | null; expiresAt: Date | string },
  status: InvitationStatus
) {
  if (status === "accepted" && invite.acceptedAt) {
    return `Accepted ${formatDate(invite.acceptedAt)}`;
  }

  if (status === "revoked" && invite.revokedAt) {
    return `Revoked ${formatDate(invite.revokedAt)}`;
  }

  if (status === "expired") {
    return `Expired ${formatDate(invite.expiresAt)}`;
  }

  return `Expires ${formatDate(invite.expiresAt)}`;
}

export default function SuperAdminUsersPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("users");

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignOrgId, setAssignOrgId] = useState("");
  const [assignBuildingId, setAssignBuildingId] = useState("");
  const [assignRole, setAssignRole] = useState<AssignableBuildingRole>("BUILDING_MANAGER");

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteBuildingId, setInviteBuildingId] = useState("");
  const [inviteUnitId, setInviteUnitId] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("TENANT");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  const usersQuery = trpc.users.list.useQuery({ search: search || undefined });
  const orgsQuery = trpc.organisations.list.useQuery();
  const buildingsQuery = trpc.buildings.list.useQuery({});
  const unitsQuery = trpc.units.listByBuilding.useQuery(
    inviteBuildingId ? { buildingId: inviteBuildingId } : skipToken
  );
  const invitesQuery = trpc.users.listInvites.useQuery({});

  const assignMutation = trpc.users.assignToBuilding.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setAssignOpen(false);
      resetAssignForm();
      toast.success("User assigned to building");
    },
    onError: (err) => toast.error(err.message ?? "Failed to assign user"),
  });

  const inviteMutation = trpc.users.createInvite.useMutation({
    onSuccess: (data) => {
      utils.users.listInvites.invalidate();
      setInviteLink(`${getAppUrl()}/invite/${data.token}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to create invite"),
  });

  const revokeMutation = trpc.users.revokeInvite.useMutation({
    onSuccess: () => {
      utils.users.listInvites.invalidate();
      toast.success("Invite revoked");
    },
    onError: (err) => toast.error(err.message ?? "Failed to revoke invite"),
  });

  const resendMutation = trpc.users.resendInvite.useMutation({
    onSuccess: () => {
      utils.users.listInvites.invalidate();
      toast.success("Invite resent");
    },
    onError: (err) => toast.error(err.message ?? "Failed to resend invite"),
  });

  const deactivateMutation = trpc.users.deactivateAssignments.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("User removed from all buildings");
    },
    onError: (err) => toast.error(err.message ?? "Failed to deactivate user"),
  });

  function resetAssignForm() {
    setAssignUserId("");
    setAssignOrgId("");
    setAssignBuildingId("");
    setAssignRole("BUILDING_MANAGER");
  }

  function resetInviteForm() {
    setInviteEmail("");
    setInviteOrgId("");
    setInviteBuildingId("");
    setInviteUnitId("");
    setInviteRole("TENANT");
    setInviteLink("");
    setCopied(false);
  }

  function handleAssign() {
    if (!assignUserId || !assignOrgId || !assignBuildingId || !assignRole) return;
    assignMutation.mutate({
      userId: assignUserId,
      organisationId: assignOrgId,
      buildingId: assignBuildingId,
      role: assignRole,
    });
  }

  function handleInvite() {
    if (!inviteEmail.trim() || !inviteOrgId || !inviteRole) return;
    if (roleRequiresUnit(inviteRole) && (!inviteBuildingId || !inviteUnitId)) return;
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      organisationId: inviteOrgId,
      buildingId: roleCanTargetBuilding(inviteRole) ? inviteBuildingId || undefined : undefined,
      unitId: roleRequiresUnit(inviteRole) ? inviteUnitId : undefined,
      role: inviteRole,
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const users = usersQuery.data ?? [];
  const orgs = orgsQuery.data ?? [];
  const buildings = buildingsQuery.data ?? [];
  const invites = invitesQuery.data ?? [];

  // Filter buildings by selected org in each dialog
  const assignBuildings = buildings.filter(
    (b) => !assignOrgId || b.organisationId === assignOrgId
  );
  const inviteBuildings = buildings.filter(
    (b) => !inviteOrgId || b.organisationId === inviteOrgId
  );
  const inviteUnits = unitsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user access across the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetInviteForm();
              setInviteOpen(true);
            }}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Invite User
          </Button>
          <Button
            onClick={() => {
              resetAssignForm();
              setAssignOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign to Building
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">
            Users
            {!usersQuery.isLoading && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({users.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invites">
            Invite History
            {!invitesQuery.isLoading && invites.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                {invites.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Buildings</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </TableCell>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-muted-foreground"
                      >
                        <Users className="mx-auto h-8 w-8 mb-2 text-muted-foreground/40" />
                        {search ? "No users match your search." : "No users found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => {
                      const primaryMembership = (user as { orgMemberships: { role: string; organisation: { name: string } }[] }).orgMemberships[0];
                      const activeBuildings = (user as { buildingAssignments: { building: { name: string } }[] }).buildingAssignments;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="text-xs">
                                  {initials(user.firstName, user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {user.firstName} {user.lastName}
                                </p>
                                {(user as { phone?: string }).phone && (
                                  <p className="text-xs text-muted-foreground">
                                    {(user as { phone?: string }).phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {primaryMembership?.organisation.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {primaryMembership ? (
                              <Badge variant="outline" className="text-xs">
                                {USER_ROLE_LABELS[primaryMembership.role as keyof typeof USER_ROLE_LABELS] ??
                                  primaryMembership.role}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Unassigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {activeBuildings.length === 0 ? (
                              <span className="text-sm text-muted-foreground">None</span>
                            ) : (
                              <span className="text-sm">
                                {activeBuildings
                                  .slice(0, 2)
                                  .map((a) => a.building.name)
                                  .join(", ")}
                                {activeBuildings.length > 2 &&
                                  ` +${activeBuildings.length - 2} more`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAssignUserId(user.id);
                                    setAssignOpen(true);
                                  }}
                                >
                                  Assign to Building
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() =>
                                    deactivateMutation.mutate({ userId: user.id })
                                  }
                                >
                                  Deactivate User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Invite Link</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitesQuery.isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : invites.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No invites yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invites.map((inv) => {
                      const link = `${getAppUrl()}/invite/${inv.token}`;
                      const status = getInvitationStatus(inv);
                      const badge = getInvitationStatusBadge(status);
                      const canResend = status !== "accepted";
                      const canRevoke = status === "pending";

                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-sm">
                            {inv.email}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getInviteScope(inv, orgs, buildings)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {USER_ROLE_LABELS[inv.role as keyof typeof USER_ROLE_LABELS] ?? inv.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                                {badge.label}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {getInviteStatusDetail(inv, status)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(inv.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                                {link}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(link);
                                  toast.success("Copied!");
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canResend && (
                                  <DropdownMenuItem
                                    disabled={resendMutation.isPending}
                                    onClick={() => resendMutation.mutate({ id: inv.id })}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Resend Invite
                                  </DropdownMenuItem>
                                )}
                                {canRevoke && (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    disabled={revokeMutation.isPending}
                                    onClick={() => revokeMutation.mutate({ id: inv.id })}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Revoke Invite
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign to Building Dialog */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) resetAssignForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Building</DialogTitle>
            <DialogDescription>
              Grant an existing user access to a building with a specific role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User *</Label>
              <Select
                value={assignUserId}
                onValueChange={(v) => { if (v) setAssignUserId(v); }}
                itemToStringLabel={(v) => { const u = users.find(u => u.id === v); return u ? `${u.firstName} ${u.lastName} — ${u.email}` : String(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} label={`${u.firstName} ${u.lastName} — ${u.email}`}>
                      {u.firstName} {u.lastName} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Organisation *</Label>
              <Select
                value={assignOrgId}
                onValueChange={(v) => {
                  if (v) {
                    setAssignOrgId(v);
                    setAssignBuildingId("");
                  }
                }}
                itemToStringLabel={(v) => orgs.find(o => o.id === v)?.name ?? String(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id} label={o.name}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Building *</Label>
              <Select
                value={assignBuildingId}
                onValueChange={(v) => { if (v) setAssignBuildingId(v); }}
                disabled={!assignOrgId}
                itemToStringLabel={(v) => { const b = assignBuildings.find(b => b.id === v); return b ? `${b.name} — ${b.suburb}` : String(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={assignOrgId ? "Select building" : "Select organisation first"} />
                </SelectTrigger>
                <SelectContent>
                  {assignBuildings.map((b) => (
                    <SelectItem key={b.id} value={b.id} label={`${b.name} — ${b.suburb}`}>
                      {b.name} — {b.suburb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={assignRole}
                onValueChange={(v) => { if (v) setAssignRole(v as AssignableBuildingRole); }}
                itemToStringLabel={(v) => ASSIGNABLE_BUILDING_ROLES.find(r => r.value === v)?.label ?? String(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_BUILDING_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={assignMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={
                !assignUserId ||
                !assignOrgId ||
                !assignBuildingId ||
                assignMutation.isPending
              }
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) resetInviteForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Generate an invite link to onboard a new user
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Share this link with the user. It expires in 7 days.
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                <code className="flex-1 text-xs break-all">{inviteLink}</code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  resetInviteForm();
                }}
              >
                Create Another Invite
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email Address *</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organisation *</Label>
                  <Select
                    value={inviteOrgId}
                    onValueChange={(v) => {
                      if (v) {
                        setInviteOrgId(v);
                        setInviteBuildingId("");
                        setInviteUnitId("");
                      }
                    }}
                    itemToStringLabel={(v) => orgs.find(o => o.id === v)?.name ?? String(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organisation" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id} label={o.name}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Building (optional)</Label>
                  <Select
                    value={inviteBuildingId}
                    onValueChange={(v) => {
                      if (v) {
                        setInviteBuildingId(v);
                        setInviteUnitId("");
                      }
                    }}
                    disabled={!inviteOrgId || !roleCanTargetBuilding(inviteRole)}
                    itemToStringLabel={(v) => { const b = inviteBuildings.find(b => b.id === v); return b ? `${b.name} — ${b.suburb}` : String(v); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !roleCanTargetBuilding(inviteRole)
                          ? "Not required for super admins"
                          : inviteOrgId
                            ? (roleRequiresUnit(inviteRole) ? "Select building" : "Optional building")
                            : "Select organisation first"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {inviteBuildings.map((b) => (
                        <SelectItem key={b.id} value={b.id} label={`${b.name} — ${b.suburb}`}>
                          {b.name} — {b.suburb}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {roleRequiresUnit(inviteRole)
                      ? "Resident invites must target a specific unit in a building."
                      : roleCanTargetBuilding(inviteRole)
                        ? "Leave building empty for organisation-level access."
                        : "Super admin invites stay platform-scoped with no building assignment."}
                  </p>
                </div>
                {roleRequiresUnit(inviteRole) && (
                  <div className="space-y-2">
                    <Label>Unit *</Label>
                    <Select
                      value={inviteUnitId}
                      onValueChange={(v) => { if (v) setInviteUnitId(v); }}
                      disabled={!inviteBuildingId}
                      itemToStringLabel={(v) => {
                        const unit = inviteUnits.find((u) => u.id === v);
                        return unit ? `Unit ${unit.unitNumber}` : String(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={inviteBuildingId ? "Select unit" : "Select building first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {inviteUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id} label={`Unit ${unit.unitNumber}`}>
                            Unit {unit.unitNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Best practice: resident invites are unit-scoped so ownership and tenancy stay attached to a real property record.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => {
                      if (v) {
                        const nextRole = v as AssignableRole;
                        setInviteRole(nextRole);
                        if (!roleCanTargetBuilding(nextRole)) {
                          setInviteBuildingId("");
                          setInviteUnitId("");
                        } else if (!roleRequiresUnit(nextRole)) {
                          setInviteUnitId("");
                        }
                      }
                    }}
                    itemToStringLabel={(v) => INVITEABLE_ROLES.find(r => r.value === v)?.label ?? String(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITEABLE_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={
                    !inviteEmail.trim() ||
                    !inviteOrgId ||
                    (roleRequiresUnit(inviteRole) && (!inviteBuildingId || !inviteUnitId)) ||
                    inviteMutation.isPending
                  }
                >
                  {inviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
