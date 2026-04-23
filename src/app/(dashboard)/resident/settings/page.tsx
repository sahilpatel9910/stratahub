"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, User } from "lucide-react";
import { toast } from "sonner";

export default function ResidentSettingsPage() {
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

  const vals = {
    firstName: draft?.firstName ?? me?.firstName ?? "",
    lastName:  draft?.lastName  ?? me?.lastName  ?? "",
    phone:     draft?.phone     ?? me?.phone      ?? "",
  };

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    updateMe.mutate({
      firstName: vals.firstName,
      lastName:  vals.lastName,
      phone:     vals.phone || null,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <p className="eyebrow-label text-primary/80">Resident Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
          Account settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          Manage your personal details and reset your password.
        </p>
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
                      value={vals.firstName}
                      onChange={(e) =>
                        setDraft((d) => ({
                          firstName: e.target.value,
                          lastName:  d?.lastName  ?? me.lastName,
                          phone:     d?.phone     ?? me.phone ?? "",
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
                      value={vals.lastName}
                      onChange={(e) =>
                        setDraft((d) => ({
                          firstName: d?.firstName ?? me.firstName,
                          lastName:  e.target.value,
                          phone:     d?.phone     ?? me.phone ?? "",
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
                    Email cannot be changed here. Contact building management.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">
                    Phone{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    className="h-11 rounded-xl bg-background"
                    placeholder="+61 4xx xxx xxx"
                    value={vals.phone}
                    onChange={(e) =>
                      setDraft((d) => ({
                        firstName: d?.firstName ?? me.firstName,
                        lastName:  d?.lastName  ?? me.lastName,
                        phone:     e.target.value,
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
              {updateMe.isPending ? "Saving…" : "Save changes"}
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
            We&apos;ll send a password reset link to{" "}
            <strong className="text-foreground">{me?.email}</strong>.
          </p>
        </div>
        <div className="flex border-t border-border/40 px-6 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-xl px-5"
            onClick={() => router.push("/forgot-password")}
          >
            Send reset link
          </Button>
        </div>
      </section>
    </div>
  );
}
