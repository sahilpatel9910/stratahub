"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package } from "lucide-react";
import { formatDateTime } from "@/lib/constants";

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-blue-100 text-blue-800",
  NOTIFIED: "bg-amber-100 text-amber-800",
  COLLECTED: "bg-emerald-100 text-emerald-700",
  RETURNED: "bg-gray-100 text-gray-600",
};

export default function ResidentParcelsPage() {
  const { data: parcels = [], isLoading } = trpc.parcels.listMyParcels.useQuery();

  const pending = parcels.filter((p) => p.status === "RECEIVED" || p.status === "NOTIFIED");
  const collected = parcels.filter((p) => p.status === "COLLECTED" || p.status === "RETURNED");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div>
          <p className="eyebrow-label text-primary/80">Resident Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
            My parcels
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            View parcels logged by building management for your unit.
          </p>
        </div>
      </section>

      {/* Awaiting Collection */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Awaiting collection
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Parcels waiting for you to pick up
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </CardContent>
          </Card>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No parcels waiting</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              You&apos;ll be notified when a parcel arrives for your unit.
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3">Recipient</TableHead>
                    <TableHead className="px-4 py-3">Carrier</TableHead>
                    <TableHead className="px-4 py-3">Location</TableHead>
                    <TableHead className="px-4 py-3">Logged</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="px-4 py-3 font-medium">{p.recipientName}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.carrier ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.storageLocation ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{formatDateTime(p.loggedAt)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={STATUS_COLORS[p.status] ?? ""}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* History */}
      {collected.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              History
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Previously collected or returned parcels
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3">Recipient</TableHead>
                    <TableHead className="px-4 py-3">Carrier</TableHead>
                    <TableHead className="px-4 py-3">Logged</TableHead>
                    <TableHead className="px-4 py-3">Collected</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collected.map((p) => (
                    <TableRow key={p.id} className="opacity-60">
                      <TableCell className="px-4 py-3 font-medium">{p.recipientName}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{p.carrier ?? "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{formatDateTime(p.loggedAt)}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {p.collectedAt ? formatDateTime(p.collectedAt) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={STATUS_COLORS[p.status] ?? ""}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
