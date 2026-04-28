"use client";

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
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface TrendPoint {
  month: string;
  maintenanceRequests: number;
  parcelsReceived: number;
  newResidents: number;
  rentCollectedCents: number;
}

interface ChartDataPoint {
  name: string;
  count?: number;
  value?: number;
}

interface AnalyticsChartsProps {
  trends: TrendPoint[];
  trendsLoading: boolean;
  occupancyData: ChartDataPoint[];
  maintenanceByPriority: ChartDataPoint[];
  maintenanceByStatus: ChartDataPoint[];
  parcelsByStatus: ChartDataPoint[];
  statsLoading: boolean;
  maintenanceLoading: boolean;
  parcelsLoading: boolean;
}

export default function AnalyticsCharts({
  trends,
  trendsLoading,
  occupancyData,
  maintenanceByPriority,
  maintenanceByStatus,
  parcelsByStatus,
  statsLoading,
  maintenanceLoading,
  parcelsLoading,
}: AnalyticsChartsProps) {
  const rentTrend = trends.map((t) => ({
    ...t,
    rentCollected: Math.round(t.rentCollectedCents / 100),
  }));

  return (
    <>
      {/* 6-Month Trends */}
      <div className="app-panel overflow-hidden p-6">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">6-Month Trends</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Maintenance Requests" loading={trendsLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="maintenanceRequests" name="Requests" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Rent Collected (AUD)" loading={trendsLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rentTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Rent"]} />
                <Bar dataKey="rentCollected" name="Rent" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Parcels Received" loading={trendsLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="parcelsReceived" name="Parcels" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="New Residents" loading={trendsLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="newResidents" name="Residents" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Snapshot Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Unit Occupancy</CardTitle></CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : occupancyData.every((d) => d.value === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-16">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {occupancyData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Maintenance by Priority</CardTitle></CardHeader>
          <CardContent>
            {maintenanceLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : maintenanceByPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No maintenance requests</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={maintenanceByPriority} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {maintenanceByPriority.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Maintenance by Status</CardTitle></CardHeader>
          <CardContent>
            {maintenanceLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : maintenanceByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No maintenance requests</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={maintenanceByStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Parcels by Status</CardTitle></CardHeader>
          <CardContent>
            {parcelsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : parcelsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No parcels recorded</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={parcelsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ChartCard({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent>{loading ? <Skeleton className="h-[220px] w-full" /> : children}</CardContent>
    </Card>
  );
}
