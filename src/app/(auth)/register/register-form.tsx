"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import { Building2 } from "lucide-react";

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
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">Set up your invited account</CardTitle>
        <CardDescription>
          Create access for {organisationName}
          {buildingName ? `, ${buildingName}` : ""}.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Invitation email</Label>
            <Input id="email" type="email" value={invitedEmail} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create invited account"}
          </Button>
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href={`/login?redirect=/invite/${inviteToken}`}
              className="text-blue-600 hover:underline"
            >
              Sign in to accept your invite
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
