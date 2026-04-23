"use client";

import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  DollarSign,
  Key,
  Megaphone,
  Package,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";

export default function ManagerDashboard() {
  const { selectedBuildingId, selectedBuildingName } = useBuildingContext();

  const statsQuery = trpc.buildings.getStats.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const maintenanceQuery = trpc.maintenance.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const announcementsQuery = trpc.announcements.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const stats = statsQuery.data;
  const maintenance = maintenanceQuery.data ?? [];
  const announcements = announcementsQuery.data ?? [];

  const recentMaintenance = maintenance.slice(0, 4);
  const recentAnnouncements = announcements.slice(0, 4);
  const hasBuilding = !!selectedBuildingId;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="app-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_56%),linear-gradient(135deg,rgba(30,41,59,0.05),transparent)] lg:block" />
        <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="max-w-3xl">
            <p className="eyebrow-label text-primary/80">Manager Overview</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
              {hasBuilding ? selectedBuildingName : "Choose a building to load the operations view"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              {hasBuilding
                ? "Monitor occupancy, revenue, access, and resident issues from one workspace designed around urgent actions and live building context."
                : "Use the selectors in the top bar to switch between organisations and buildings. Once a building is selected, the dashboard will surface current workload, resident activity, and payment signals."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CompactMetric
                label="Open maintenance"
                value={stats?.openMaintenanceCount}
                loading={statsQuery.isLoading && hasBuilding}
                href="/manager/maintenance"
              />
              <CompactMetric
                label="Overdue rent"
                value={stats?.overdueRentCount}
                loading={statsQuery.isLoading && hasBuilding}
                href="/manager/rent"
              />
              <CompactMetric
                label="Pending parcels"
                value={stats?.pendingParcelCount}
                loading={statsQuery.isLoading && hasBuilding}
                href="/manager/parcels"
              />
              <CompactMetric
                label="Keys to rotate"
                value={stats?.keysToRotate}
                loading={statsQuery.isLoading && hasBuilding}
                href="/manager/keys"
              />
            </div>
          </div>

          <div className="app-grid-panel metric-glow bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="panel-kicker">Building Health</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats ? `${stats.occupancyRate}%` : "—"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {stats
                    ? `${stats.occupiedUnits} occupied units out of ${stats.totalUnits}`
                    : "Occupancy updates appear here after a building is selected."}
                </p>
              </div>
              <div className="rounded-2xl bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground">
                Live
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <SignalRow
                icon={DollarSign}
                label="Collected this month"
                value={stats ? formatCurrency(stats.rentCollectedThisMonthCents) : "—"}
              />
              <SignalRow
                icon={Users}
                label="Residents"
                value={stats ? String(stats.residentCount) : "—"}
              />
              <SignalRow
                icon={Building2}
                label="Total units"
                value={stats ? String(stats.totalUnits) : "—"}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatPanel
          title="Total Units"
          value={stats ? String(stats.totalUnits) : null}
          description="Registered in the selected building"
          icon={Building2}
          loading={statsQuery.isLoading && hasBuilding}
          href="/manager/units"
        />
        <StatPanel
          title="Residents"
          value={stats ? String(stats.residentCount) : null}
          description="Owners and tenants currently active"
          icon={Users}
          loading={statsQuery.isLoading && hasBuilding}
          href="/manager/residents"
        />
        <StatPanel
          title="Rent Collected"
          value={stats ? formatCurrency(stats.rentCollectedThisMonthCents) : null}
          description="Collections recorded this month"
          icon={DollarSign}
          loading={statsQuery.isLoading && hasBuilding}
          href="/manager/rent"
        />
        <StatPanel
          title="Occupancy Rate"
          value={stats ? `${stats.occupancyRate}%` : null}
          description={stats ? `${stats.occupiedUnits} occupied of ${stats.totalUnits}` : "Occupied versus total units"}
          icon={TrendingUp}
          loading={statsQuery.isLoading && hasBuilding}
          href="/manager/units"
        />
      </div>

      {!hasBuilding && (
        <div className="app-panel p-6">
          <p className="text-sm font-medium text-foreground">No building selected</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Select a building from the organisation and building controls in the header to load dashboard metrics, resident activity, maintenance requests, and announcements.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-panel p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <p className="panel-kicker">Operational Focus</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                Priority areas for today
              </h2>
            </div>
            <div className="rounded-full border border-border/70 bg-white/80 px-3 py-1 text-xs text-muted-foreground">
              Updated live
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionRow
              title="Maintenance"
              detail={stats?.openMaintenanceCount !== undefined ? `${stats.openMaintenanceCount} open requests` : "No data yet"}
              icon={Wrench}
              href="/manager/maintenance"
            />
            <ActionRow
              title="Rent"
              detail={stats?.overdueRentCount !== undefined ? `${stats.overdueRentCount} overdue payments` : "No data yet"}
              icon={AlertTriangle}
              href="/manager/rent"
            />
            <ActionRow
              title="Parcels"
              detail={stats?.pendingParcelCount !== undefined ? `${stats.pendingParcelCount} awaiting pickup` : "No data yet"}
              icon={Package}
              href="/manager/parcels"
            />
            <ActionRow
              title="Access"
              detail={stats?.keysToRotate !== undefined ? `${stats.keysToRotate} keys to review` : "No data yet"}
              icon={Key}
              href="/manager/keys"
            />
          </div>
        </section>

        <section className="app-panel p-6">
          <div className="border-b border-border/70 pb-4">
            <p className="panel-kicker">Resident Communications</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              Recent announcements
            </h2>
          </div>

          <div className="mt-5">
            {!hasBuilding ? (
              <p className="text-sm text-muted-foreground">
                Select a building to view announcements.
              </p>
            ) : announcementsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No announcements found.
              </p>
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.map((announcement) => (
                  <Link
                    key={announcement.id}
                    href="/manager/announcements"
                    className="block rounded-2xl border border-border/70 bg-white/70 px-4 py-4 transition-colors hover:bg-white/90"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{announcement.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {announcement.author.firstName} {announcement.author.lastName}
                        </p>
                      </div>
                      <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="app-panel p-6">
        <div className="border-b border-border/70 pb-4">
          <p className="panel-kicker">Latest Issues</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            Recent maintenance requests
          </h2>
        </div>

        <div className="mt-5">
          {!hasBuilding ? (
            <p className="text-sm text-muted-foreground">
              Select a building to view maintenance requests.
            </p>
          ) : maintenanceQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : recentMaintenance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No maintenance requests found.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-white/70">
              {recentMaintenance.map((request, index) => (
                <Link
                  key={request.id}
                  href="/manager/maintenance"
                  className={`flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/30 ${index !== recentMaintenance.length - 1 ? "border-b border-border/70" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{request.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Unit {request.unit.unitNumber} by {request.requestedBy.firstName} {request.requestedBy.lastName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={request.priority} />
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-white/70 bg-white/72 px-4 py-4 backdrop-blur-sm transition-colors hover:bg-white/90">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-14" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          {value ?? "—"}
        </p>
      )}
    </Link>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/60 text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatPanel({
  title,
  value,
  description,
  icon: Icon,
  loading,
  href,
}: {
  title: string;
  value: string | null;
  description: string;
  icon: React.ElementType;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="app-grid-panel block p-5 transition-opacity hover:opacity-80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <>
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-2 h-4 w-32" />
            </>
          ) : (
            <>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                {value ?? <span className="text-base text-muted-foreground">—</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/55 text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function ActionRow({
  title,
  detail,
  icon: Icon,
  href,
}: {
  title: string;
  detail: string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/72 px-4 py-4 transition-colors hover:bg-white">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/55 text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "border-red-200 bg-red-50 text-red-700",
    URGENT: "border-red-200 bg-red-50 text-red-700",
    MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
    LOW: "border-border bg-muted text-foreground",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[priority] ?? "border-border bg-muted text-foreground"
      }`}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
