"use client";

import { skipToken } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  DollarSign,
  Wrench,
  Package,
  Key,
  AlertTriangle,
  TrendingUp,
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

  const recentMaintenance = maintenance.slice(0, 3);
  const recentAnnouncements = announcements.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {selectedBuildingName
            ? `Overview for ${selectedBuildingName}`
            : "Select a building from the top bar to view stats"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Units"
          value={stats ? String(stats.totalUnits) : null}
          description="In this building"
          icon={Building2}
          color="text-blue-600"
          bg="bg-blue-50"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <StatCard
          title="Residents"
          value={stats ? String(stats.residentCount) : null}
          description="Owners & tenants"
          icon={Users}
          color="text-green-600"
          bg="bg-green-50"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <StatCard
          title="Rent Collected"
          value={
            stats ? formatCurrency(stats.rentCollectedThisMonthCents) : null
          }
          description="This month"
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <StatCard
          title="Occupancy Rate"
          value={stats ? `${stats.occupancyRate}%` : null}
          description={
            stats
              ? `${stats.occupiedUnits} of ${stats.totalUnits} units occupied`
              : "Occupied vs total units"
          }
          icon={TrendingUp}
          color="text-purple-600"
          bg="bg-purple-50"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          title="Open Maintenance"
          count={stats?.openMaintenanceCount}
          icon={Wrench}
          color="text-orange-600"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <QuickActionCard
          title="Overdue Rent"
          count={stats?.overdueRentCount}
          icon={AlertTriangle}
          color="text-red-600"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <QuickActionCard
          title="Uncollected Parcels"
          count={stats?.pendingParcelCount}
          icon={Package}
          color="text-amber-600"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
        <QuickActionCard
          title="Keys to Rotate"
          count={stats?.keysToRotate}
          icon={Key}
          color="text-violet-600"
          loading={statsQuery.isLoading && !!selectedBuildingId}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Maintenance Requests</CardTitle>
            <CardDescription>Latest requests from residents</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBuildingId ? (
              <p className="text-sm text-muted-foreground">
                Select a building to view maintenance requests.
              </p>
            ) : maintenanceQuery.isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentMaintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No maintenance requests found.
              </p>
            ) : (
              <div className="space-y-4">
                {recentMaintenance.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Unit {req.unit.unitNumber} &mdash;{" "}
                        {req.requestedBy.firstName} {req.requestedBy.lastName}
                      </p>
                    </div>
                    <div className="text-right">
                      <PriorityBadge priority={req.priority} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Latest building updates</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBuildingId ? (
              <p className="text-sm text-muted-foreground">
                Select a building to view announcements.
              </p>
            ) : announcementsQuery.isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No announcements found.
              </p>
            ) : (
              <div className="space-y-4">
                {recentAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{ann.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {ann.author.firstName} {ann.author.lastName}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ann.publishedAt
                        ? new Date(ann.publishedAt).toLocaleDateString(
                            "en-AU",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "Draft"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  bg,
  loading,
}: {
  title: string;
  value: string | null;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="mb-1 h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {value ?? <span className="text-muted-foreground text-base">—</span>}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  count,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  count: number | undefined;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {loading ? (
            <Skeleton className="mt-1 h-3 w-12" />
          ) : (
            <CardDescription>
              {count !== undefined ? `${count} items` : "—"}
            </CardDescription>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    URGENT: "bg-red-100 text-red-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[priority] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}
