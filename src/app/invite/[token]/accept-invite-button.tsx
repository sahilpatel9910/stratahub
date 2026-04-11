"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setDone(true);
    // Give a moment for the success state to show before redirecting
    setTimeout(() => router.push("/"), 1200);
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm py-2">
        <CheckCircle2 className="h-4 w-4" />
        Invite accepted! Redirecting...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={handleAccept} disabled={loading}>
        {loading ? "Accepting..." : "Accept Invite"}
      </Button>
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
