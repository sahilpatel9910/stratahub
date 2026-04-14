"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="app-panel overflow-hidden">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(30,64,175,0.08))] px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="panel-kicker text-primary/75">Secure Access</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Welcome back
            </h1>
          </div>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Sign in to review building activity, resident requests, and day-to-day operations.
        </p>
      </div>

      <form onSubmit={handleLogin} className="px-6 py-6">
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/55 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure workspace access
            </div>
            <span className="text-muted-foreground">Supabase Auth</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary transition-colors hover:text-primary/80">
              Register
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
