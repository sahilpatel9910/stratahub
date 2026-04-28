import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentDashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Hero panel */}
      <div className="app-panel p-6 md:p-8">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="mt-3 h-10 w-64 rounded-xl" />
        <Skeleton className="mt-4 h-4 w-48 rounded-full" />
      </div>
      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="app-panel p-5">
          <Skeleton className="h-5 w-36 rounded-full mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="app-panel p-5">
          <Skeleton className="h-5 w-36 rounded-full mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
