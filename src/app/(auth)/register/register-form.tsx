"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";

type RegisterFormProps = {
  inviteToken: string;
  invitedEmail: string;
  organisationName: string;
  buildingName?: string;
};

export function RegisterForm({
  inviteToken,
  invitedEmail,
  organisationName,
  buildingName,
}: RegisterFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const redirectUrl = new URL("/api/auth/callback", window.location.origin);
    redirectUrl.searchParams.set("next", `/invite/${inviteToken}`);

    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (
      signUpData.user &&
      Array.isArray(signUpData.user.identities) &&
      signUpData.user.identities.length === 0
    ) {
      setError(
        "An account for this invitation already exists. Please sign in to accept your invite."
      );
      setLoading(false);
      return;
    }

    if (signUpData.session) {
      const acceptRes = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });

      if (!acceptRes.ok) {
        const json = await acceptRes.json().catch(() => ({}));
        setError(
          json.error ??
            "Your account was created, but the invitation could not be accepted yet."
        );
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    router.push(`/invite/${inviteToken}?created=1`);
  }

  return (
    <div className="app-panel overflow-hidden">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(30,64,175,0.08))] px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="panel-kicker text-primary/75">Invite Access</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Set up your invited account
            </h1>
          </div>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Create access for {organisationName}
          {buildingName ? `, ${buildingName}` : ""}.
        </p>
      </div>

      <form onSubmit={handleRegister} className="px-6 py-6">
        <div className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                First name
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-12 rounded-xl border-white/70 bg-white/90 shadow-none"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                Last name
              </Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-12 rounded-xl border-white/70 bg-white/90 shadow-none"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Invitation email
            </Label>
            <Input
              id="email"
              type="email"
              value={invitedEmail}
              disabled
              className="h-12 rounded-xl border-white/70 bg-secondary/70 text-muted-foreground shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-white/70 bg-white/90 shadow-none"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl border-white/70 bg-white/90 shadow-none"
              required
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create invited account"}
            {!loading && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/55 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Invite-linked account setup
            </div>
            <span className="text-muted-foreground">Secure</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={`/login?redirect=/invite/${inviteToken}`}
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              Sign in to accept your invite
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
