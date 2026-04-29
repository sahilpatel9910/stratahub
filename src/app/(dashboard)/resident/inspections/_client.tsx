"use client";

import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { ClipboardList } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function ResidentInspectionsClient() {
  const { data: tenancy } = trpc.resident.getMyTenancy.useQuery();

  const unitId = tenancy?.unitId;

  const { data: inspections = [], isLoading } = trpc.inspection.listByUnit.useQuery(
    unitId ? { unitId } : skipToken
  );

  if (!unitId && !isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <p className="eyebrow-label text-primary/80">Resident Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">Inspections</h1>
        </section>
        <section className="app-panel px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold text-foreground">No unit linked</p>
          <p className="mt-2 text-sm text-muted-foreground">Inspections will appear here once your unit is set up.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <p className="eyebrow-label text-primary/80">Resident Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">Inspections</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">Upcoming and past inspections for your unit.</p>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="divide-y divide-border/60">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : inspections.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No inspections scheduled.
            </div>
          ) : (
            inspections.map((insp) => (
              <div key={insp.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {TYPE_LABELS[insp.type] ?? insp.type} inspection
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(insp.scheduledAt)} · {insp.inspectedBy.firstName} {insp.inspectedBy.lastName}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[insp.status] ?? ""}`}>
                  {insp.status.charAt(0) + insp.status.slice(1).toLowerCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
