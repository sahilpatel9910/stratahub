"use client";

import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/constants";
import { Building2, Calendar, ChevronRight, DollarSign, Megaphone, Wrench } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentDashboardClient() {
  const { data: profile, isLoading } = trpc.resident.getMyProfile.useQuery();
  const { data: levies = [], isLoading: leviesLoading } = trpc.resident.getMyLevies.useQuery({});
  const { data: maintenance = [], isLoading: maintenanceLoading } = trpc.resident.getMyMaintenanceRequests.useQuery({});
  const { data: announcements = [] } = trpc.resident.getMyAnnouncements.useQuery();

  const unpaidTotal = levies
    .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.amountCents, 0);

  const openMaintenance = maintenance.filter(
    (m) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(m.status)
  ).length;

  const firstName = profile?.firstName ?? "Resident";
  const units = [
    ...(profile?.ownerships ?? []).map((o) => o.unit),
    ...(profile?.tenancies ?? []).map((t) => t.unit),
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Resident Workspace</p>
            {isLoading ? (
              <>
                <Skeleton className="mt-3 h-10 w-72 rounded-xl" />
                <Skeleton className="mt-4 h-5 w-56 rounded-full" />
              </>
            ) : (
              <>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                  Welcome back, {firstName}
                </h1>
                {units.length > 0 ? (
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                    {units.map((u) => `Unit ${u.unitNumber} — ${u.building.name}`).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                    Your portal will show levies, requests, and announcements as soon as your unit assignment is active.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Current Status</p>
            <div className="mt-4 space-y-3">
              <ResidentSignal
                label="Outstanding levies"
                value={unpaidTotal > 0 ? formatCurrency(unpaidTotal) : "All paid"}
              />
              <ResidentSignal
                label="Open maintenance"
                value={`${openMaintenance} active`}
              />
              <ResidentSignal
                label="Announcements"
                value={`${announcements.length} live`}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {leviesLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <ResidentStatCard
            href="/resident/levies"
            icon={DollarSign}
            label="Outstanding Levies"
            value={unpaidTotal > 0 ? formatCurrency(unpaidTotal) : "All paid"}
            tone={unpaidTotal > 0 ? "warning" : "positive"}
          />
        )}
        {maintenanceLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <ResidentStatCard
            href="/resident/maintenance"
            icon={Wrench}
            label="Open Requests"
            value={`${openMaintenance} open`}
            tone={openMaintenance > 0 ? "default" : "muted"}
          />
        )}
        <ResidentStatCard
          href="/resident/announcements"
          icon={Megaphone}
          label="Announcements"
          value={`${announcements.length} active`}
          tone="default"
        />
      </div>

      {announcements.length > 0 && (
        <section className="app-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
            <div>
              <p className="panel-kicker">Building Updates</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                Recent announcements
              </h2>
            </div>
            <Link
              href="/resident/announcements"
              className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border/70">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{announcement.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground line-clamp-2">
                      {announcement.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(announcement.createdAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {units.length === 0 && (
        <section className="app-panel px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/55 text-accent-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-foreground">
            No unit assigned yet
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Contact your building manager to be linked to a unit and unlock your resident dashboard.
          </p>
        </section>
      )}
    </div>
  );
}

function ResidentSignal({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ResidentStatCard({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "default" | "warning" | "positive" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-accent/55 text-accent-foreground",
    warning: "bg-orange-100 text-orange-700",
    positive: "bg-emerald-100 text-emerald-700",
    muted: "bg-secondary text-secondary-foreground",
  };

  return (
    <Link
      href={href}
      className="app-grid-panel block p-5 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
        View details
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
