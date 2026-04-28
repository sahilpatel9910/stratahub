"use client";

import dynamic from "next/dynamic";
import { skipToken } from "@tanstack/react-query";
import { AlertTriangle, Building2, ClipboardList, PackageCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";

// Recharts is ~300KB — load it only after the page shell renders
const AnalyticsCharts = dynamic(() => import("./_charts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  ),
});

export default function AnalyticsPage() {
  const { selectedBuildingId } = useBuildingContext();

  const statsQuery = trpc.buildings.getStats.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );
  const trendsQuery = trpc.buildings.getTrends.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );
  const maintenanceQuery = trpc.maintenance.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );
  const parcelsQuery = trpc.parcels.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const stats = statsQuery.data;
  const trends = trendsQuery.data ?? [];
  const maintenance = maintenanceQuery.data ?? [];
  const parcels = parcelsQuery.data ?? [];

  // Computed data passed to the chart bundle
  const maintenanceByStatus = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"]
    .map((status) => ({ name: status.replace("_", " "), count: maintenance.filter((m: { status: string }) => m.status === status).length }))
    .filter((d) => d.count > 0);

  const maintenanceByPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"]
    .map((p) => ({ name: p, value: maintenance.filter((m: { priority: string }) => m.priority === p).length }))
    .filter((d) => d.value > 0);

  const parcelsByStatus = ["RECEIVED", "NOTIFIED", "COLLECTED", "RETURNED"]
    .map((s) => ({ name: s, count: parcels.filter((p: { status: string }) => p.status === s).length }))
    .filter((d) => d.count > 0);

  const occupancyData = stats
    ? [{ name: "Occupied", value: stats.occupiedUnits }, { name: "Vacant", value: stats.totalUnits - stats.occupiedUnits }]
    : [];

  return (
    <div className="space-y-6">
      {/* Hero panel — renders immediately, no recharts dependency */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Building overview and operations metrics
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Track occupancy, maintenance workload, parcel handling, rent collection, and 6-month trends across your building.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">At a glance</p>
            <div className="mt-4 space-y-3">
              <AnalyticsSignal icon={Building2} label="Occupancy" value={stats ? `${stats.occupancyRate}%` : "—"} tone="text-blue-600" />
              <AnalyticsSignal icon={ClipboardList} label="Open maintenance" value={stats ? String(stats.openMaintenanceCount) : "—"} tone="text-amber-600" />
              <AnalyticsSignal icon={PackageCheck} label="Pending parcels" value={stats ? String(stats.pendingParcelCount) : "—"} tone="text-emerald-600" />
              <AnalyticsSignal icon={AlertTriangle} label="Overdue rent" value={stats ? String(stats.overdueRentCount) : "—"} tone="text-red-600" />
            </div>
          </div>
        </div>
      </section>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view analytics.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI cards — no recharts, render instantly */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Occupancy Rate" value={statsQuery.isLoading ? null : `${stats?.occupancyRate ?? 0}%`} subtitle={`${stats?.occupiedUnits ?? 0} / ${stats?.totalUnits ?? 0} units`} />
            <StatCard title="Open Maintenance" value={statsQuery.isLoading ? null : String(stats?.openMaintenanceCount ?? 0)} subtitle="Active requests" />
            <StatCard title="Pending Parcels" value={statsQuery.isLoading ? null : String(stats?.pendingParcelCount ?? 0)} subtitle="Awaiting collection" />
            <StatCard title="Rent This Month" value={statsQuery.isLoading ? null : formatCurrency(stats?.rentCollectedThisMonthCents ?? 0)} subtitle={`${stats?.overdueRentCount ?? 0} overdue payments`} />
          </div>

          {/* Charts — lazy loaded, recharts bundle arrives after above content */}
          <AnalyticsCharts
            trends={trends}
            trendsLoading={trendsQuery.isLoading}
            occupancyData={occupancyData}
            maintenanceByPriority={maintenanceByPriority}
            maintenanceByStatus={maintenanceByStatus}
            parcelsByStatus={parcelsByStatus}
            statsLoading={statsQuery.isLoading}
            maintenanceLoading={maintenanceQuery.isLoading}
            parcelsLoading={parcelsQuery.isLoading}
          />
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string | null; subtitle: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {value === null ? <Skeleton className="mt-2 h-7 w-20" /> : <p className="mt-2 text-2xl font-bold">{value}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsSignal({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
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
