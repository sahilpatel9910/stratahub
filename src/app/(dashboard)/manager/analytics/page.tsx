"use client";

import { skipToken } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { formatCurrency } from "@/lib/constants";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsPage() {
  const { selectedBuildingId } = useBuildingContext();

  const statsQuery = trpc.buildings.getStats.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const maintenanceQuery = trpc.maintenance.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const parcelsQuery = trpc.parcels.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const stats = statsQuery.data;
  const maintenance = maintenanceQuery.data ?? [];
  const parcels = parcelsQuery.data ?? [];

  // Maintenance by status
  const maintenanceByStatus = [
    "SUBMITTED",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
  ].map((status) => ({
    name: status.replace("_", " "),
    count: maintenance.filter((m: { status: string }) => m.status === status).length,
  })).filter((d) => d.count > 0);

  // Maintenance by priority
  const maintenanceByPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].map(
    (p) => ({
      name: p,
      value: maintenance.filter((m: { priority: string }) => m.priority === p).length,
    })
  ).filter((d) => d.value > 0);

  // Parcels by status
  const parcelsByStatus = ["RECEIVED", "NOTIFIED", "COLLECTED", "RETURNED"].map(
    (s) => ({
      name: s,
      count: parcels.filter((p: { status: string }) => p.status === s).length,
    })
  ).filter((d) => d.count > 0);

  // Occupancy data
  const occupancyData = stats
    ? [
        { name: "Occupied", value: stats.occupiedUnits },
        { name: "Vacant", value: stats.totalUnits - stats.occupiedUnits },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Building performance overview and key metrics
        </p>
      </div>

      {!selectedBuildingId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a building from the top bar to view analytics.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Occupancy Rate"
              value={statsQuery.isLoading ? null : `${stats?.occupancyRate ?? 0}%`}
              subtitle={`${stats?.occupiedUnits ?? 0} / ${stats?.totalUnits ?? 0} units`}
            />
            <StatCard
              title="Open Maintenance"
              value={statsQuery.isLoading ? null : String(stats?.openMaintenanceCount ?? 0)}
              subtitle="Active requests"
            />
            <StatCard
              title="Pending Parcels"
              value={statsQuery.isLoading ? null : String(stats?.pendingParcelCount ?? 0)}
              subtitle="Awaiting collection"
            />
            <StatCard
              title="Rent This Month"
              value={
                statsQuery.isLoading
                  ? null
                  : formatCurrency(stats?.rentCollectedThisMonthCents ?? 0)
              }
              subtitle={`${stats?.overdueRentCount ?? 0} overdue payments`}
            />
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Unit Occupancy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : occupancyData.every((d) => d.value === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-16">
                    No data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={occupancyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {occupancyData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Maintenance by Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                {maintenanceQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : maintenanceByPriority.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">
                    No maintenance requests
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={maintenanceByPriority}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {maintenanceByPriority.map((_, index) => (
                          <Cell
                            key={index}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Maintenance by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {maintenanceQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : maintenanceByStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">
                    No maintenance requests
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={maintenanceByStatus}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Parcels by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {parcelsQuery.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : parcelsByStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-16">
                    No parcels recorded
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={parcelsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | null;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-7 w-20 mb-1" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
