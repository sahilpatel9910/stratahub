"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Camera, Lock, Shield, Trash2, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { NotificationType } from "@/generated/prisma/client";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  BUILDING_MANAGER: "Building Manager",
  RECEPTION: "Reception",
  OWNER: "Owner",
  TENANT: "Tenant",
};

const NOTIFICATION_LABELS: { type: NotificationType; label: string; description: string }[] = [
  { type: "MESSAGE_RECEIVED",           label: "New message received",       description: "When a resident or staff member sends you a message" },
  { type: "MAINTENANCE_STATUS_UPDATED", label: "Maintenance status updated",  description: "When a maintenance request changes status" },
  { type: "MAINTENANCE_CREATED",        label: "New maintenance request",     description: "When a resident submits a new maintenance request" },
  { type: "ANNOUNCEMENT_PUBLISHED",     label: "Announcement published",      description: "When a new announcement is posted to your building" },
  { type: "PARCEL_RECEIVED",            label: "Parcel received",             description: "When a parcel is logged at reception" },
  { type: "LEVY_CREATED",               label: "Levy created",                description: "When a new strata levy is issued" },
  { type: "INVITE_SENT",                label: "Invite sent",                 description: "When an invitation is sent to a new user" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading } = trpc.users.getMe.useQuery();
  const utils = trpc.useUtils();
  const updateMe = trpc.users.updateMe.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (e) => toast.error(e.message),
  });
  const [draft, setDraft] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const prefsQuery = trpc.notificationPreferences.list.useQuery();
  const updatePref = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => void utils.notificationPreferences.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const setAvatarUrl = trpc.avatar.setUrl.useMutation({
    onSuccess: () => {
      void utils.users.getMe.invalidate();
      toast.success("Avatar updated");
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${me.supabaseAuthId}.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      setAvatarUrl.mutate({ url: publicUrl });
    } catch (err) {
      toast.error("Upload failed");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    if (!me) return;
    setUploading(true);
    try {
      const supabase = createClient();
      await supabase.storage.from("avatars").remove([
        `${me.supabaseAuthId}.jpg`,
        `${me.supabaseAuthId}.jpeg`,
        `${me.supabaseAuthId}.png`,
        `${me.supabaseAuthId}.webp`,
      ]);
      setAvatarUrl.mutate({ url: null });
    } catch (err) {
      toast.error("Remove failed");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

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
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Account settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Manage your personal details, reset your password, and review your active roles.
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

      {/* Avatar */}
      <section className="app-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Camera className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Profile photo</h2>
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP — max 2 MB</p>
          </div>
        </div>
        <div className="flex items-center gap-5 px-6 py-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={
              me?.avatarUrl
                ? undefined
                : { background: "linear-gradient(135deg, oklch(0.58 0.11 195), oklch(0.39 0.06 245))" }
            }
          >
            {me?.avatarUrl ? (
              <img src={me.avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              <span>
                {me ? `${me.firstName[0]}${me.lastName[0]}`.toUpperCase() : "?"}
              </span>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl px-4 text-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              {me?.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {me?.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-xl px-4 text-sm text-destructive hover:text-destructive"
                onClick={handleAvatarRemove}
                disabled={uploading}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remove photo
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
      </section>

      {/* Profile */}
      <section className="app-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
            <p className="text-xs text-muted-foreground">Update your name and contact number</p>
          </div>
        </div>
        <form onSubmit={handleSave}>
          <div className="flex flex-col gap-5 px-6 py-5">
            {isLoading ? (
              <>
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </>
            ) : me ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={me.email ?? ""}
                    disabled
                    className="h-11 rounded-xl bg-muted/40"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed here. Contact your administrator.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Phone <span className="text-[11px] font-normal text-muted-foreground">(optional)</span></Label>
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
            )}
          </div>
          <div className="flex justify-end border-t border-border/40 px-6 py-4">
            <Button
              type="submit"
              className="h-11 rounded-xl px-5"
              disabled={isLoading || updateMe.isPending || !me}
            >
              {updateMe.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </section>

      {/* Password */}
      <section className="app-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
            <Lock className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Password</h2>
            <p className="text-xs text-muted-foreground">Change your account password</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a password reset link to <strong className="text-foreground">{me?.email}</strong>.
          </p>
        </div>
        <div className="flex border-t border-border/40 px-6 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={() => router.push("/forgot-password")}
          >
            Send Reset Link
          </Button>
        </div>
      </section>

      {/* Roles */}
      <section className="app-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Roles &amp; Access</h2>
            <p className="text-xs text-muted-foreground">Your current permissions in this system</p>
          </div>
        </div>
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          ) : me?.orgMemberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {me?.orgMemberships.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-white/75 px-3 py-1.5"
                >
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {m.organisation.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="app-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Bell className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Notification preferences</h2>
            <p className="text-xs text-muted-foreground">Choose which notifications you receive</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {NOTIFICATION_LABELS.map(({ type, label, description }) => {
            const pref = prefsQuery.data?.find((p) => p.type === type);
            const enabled = pref?.enabled ?? true;
            return (
              <div key={type} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(value) =>
                    updatePref.mutate({ type, enabled: value })
                  }
                  disabled={updatePref.isPending}
                />
              </div>
            );
          })}
        </div>
      </section>
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
