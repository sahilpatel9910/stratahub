import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Hero panel */}
      <div className="app-panel p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="mt-3 h-9 w-3/4 rounded-xl" />
            <Skeleton className="mt-3 h-4 w-2/3 rounded-full" />
          </div>
          <div className="app-grid-panel p-5 space-y-3">
            <Skeleton className="h-3 w-20 rounded-full" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Trends panel — 2x2 chart grid */}
      <div className="app-panel p-6">
        <Skeleton className="h-4 w-36 rounded-full mb-5" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
      {/* Snapshot charts — 2x2 grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
