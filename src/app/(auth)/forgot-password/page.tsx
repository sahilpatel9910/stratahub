"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, ChevronRight, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="app-panel overflow-hidden">
        <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(14,165,233,0.08))] px-6 py-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <MailCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="panel-kicker text-emerald-700/80">Reset Sent</p>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Check your email
              </h1>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Open the email and follow the link to set a new password.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <Link href="/login" className="block">
            <Button variant="outline" className="h-12 w-full rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-panel overflow-hidden">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(30,64,175,0.08))] px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="panel-kicker text-primary/75">Password Help</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Reset your password
            </h1>
          </div>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Enter your email and we&apos;ll send you a secure reset link.
        </p>
      </div>

      <form onSubmit={handleReset} className="px-6 py-6">
        <div className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Sending..." : "Send Reset Link"}
            {!loading && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
          <Link
            href="/login"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
