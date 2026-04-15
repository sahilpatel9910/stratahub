"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Shield, User, UserCog } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  BUILDING_MANAGER: "Building Manager",
  RECEPTION: "Reception",
  OWNER: "Owner",
  TENANT: "Tenant",
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading } = trpc.users.getMe.useQuery();
  const updateMe = trpc.users.updateMe.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (e) => toast.error(e.message),
  });
  const [draft, setDraft] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);

  const profileValues = {
    firstName: draft?.firstName ?? me?.firstName ?? "",
    lastName: draft?.lastName ?? me?.lastName ?? "",
    phone: draft?.phone ?? me?.phone ?? "",
  };

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    updateMe.mutate({
      firstName: profileValues.firstName,
      lastName: profileValues.lastName,
      phone: profileValues.phone || null,
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Account settings and access details
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Manage your personal details, reset your password safely, and review the roles currently attached to your account.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Account snapshot</p>
            <div className="mt-4 space-y-3">
              <SettingsSignal icon={UserCog} label="Profile" value={me ? "Loaded" : isLoading ? "Loading" : "Unavailable"} tone="text-blue-600" />
              <SettingsSignal icon={Shield} label="Active roles" value={me ? String(me.orgMemberships.length) : "—"} tone="text-emerald-600" />
              <SettingsSignal icon={Lock} label="Password reset" value="Available" tone="text-amber-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Profile</CardTitle>
          </div>
          <CardDescription>Update your name and contact number</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </>
            ) : (
              me ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        className="h-11 rounded-xl bg-background"
                        value={profileValues.firstName}
                        onChange={(e) =>
                          setDraft((current) => ({
                            firstName: e.target.value,
                            lastName: current?.lastName ?? me.lastName,
                            phone: current?.phone ?? me.phone ?? "",
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        className="h-11 rounded-xl bg-background"
                        value={profileValues.lastName}
                        onChange={(e) =>
                          setDraft((current) => ({
                            firstName: current?.firstName ?? me.firstName,
                            lastName: e.target.value,
                            phone: current?.phone ?? me.phone ?? "",
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={me.email ?? ""}
                      disabled
                      className="h-11 rounded-xl bg-gray-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed here. Contact your administrator.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      className="h-11 rounded-xl bg-background"
                      placeholder="+61 4xx xxx xxx"
                      value={profileValues.phone}
                      onChange={(e) =>
                        setDraft((current) => ({
                          firstName: current?.firstName ?? me.firstName,
                          lastName: current?.lastName ?? me.lastName,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load your profile.</p>
              )
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || updateMe.isPending || !me}>
              {updateMe.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Password</CardTitle>
          </div>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a password reset link to <strong>{me?.email}</strong>.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => router.push("/forgot-password")}
          >
            Send Reset Link
          </Button>
        </CardFooter>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Roles &amp; Access</CardTitle>
          </div>
          <CardDescription>Your current permissions in this system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : me?.orgMemberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {me?.orgMemberships.map((m, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/35 px-3 py-1.5">
                  <Badge variant="outline">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.organisation.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSignal({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
