"use client";

import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/constants";
import { DollarSign, Wrench, Megaphone, Building2 } from "lucide-react";
import Link from "next/link";

export default function ResidentDashboard() {
  const { data: profile, isLoading } = trpc.resident.getMyProfile.useQuery();
  const { data: levies = [] } = trpc.resident.getMyLevies.useQuery({});
  const { data: maintenance = [] } = trpc.resident.getMyMaintenanceRequests.useQuery({});
  const { data: announcements = [] } = trpc.resident.getMyAnnouncements.useQuery();

  const unpaidTotal = levies
    .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.amountCents, 0);

  const openMaintenance = maintenance.filter(
    (m) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(m.status)
  ).length;

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  const firstName = profile?.firstName ?? "Resident";
  const units = [
    ...( profile?.ownerships ?? []).map((o) => o.unit),
    ...( profile?.tenancies ?? []).map((t) => t.unit),
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
        {units.length > 0 && (
          <p className="text-muted-foreground mt-1">
            {units.map((u) => `Unit ${u.unitNumber} — ${u.building.name}`).join(" · ")}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          href="/resident/levies"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          label="Outstanding Levies"
          value={unpaidTotal > 0 ? formatCurrency(unpaidTotal) : "All paid"}
          highlight={unpaidTotal > 0}
        />
        <StatCard
          href="/resident/maintenance"
          icon={<Wrench className="h-5 w-5 text-blue-500" />}
          label="Open Requests"
          value={String(openMaintenance)}
          highlight={openMaintenance > 0}
        />
        <StatCard
          href="/resident/announcements"
          icon={<Megaphone className="h-5 w-5 text-purple-500" />}
          label="Announcements"
          value={String(announcements.length)}
        />
      </div>

      {/* Recent Announcements */}
      {announcements.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold">Recent Announcements</h2>
            <Link href="/resident/announcements" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-sm">{a.title}</p>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">
                    {new Date(a.createdAt).toLocaleDateString("en-AU")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Building info */}
      {units.length === 0 && (
        <div className="rounded-lg border bg-white px-6 py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">No unit assigned yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your building manager to be assigned to a unit.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  highlight = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${highlight ? "text-orange-600" : ""}`}>{value}</p>
      </div>
    </Link>
  );
}
