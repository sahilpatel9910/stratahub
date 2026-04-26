import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerDashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* Hero panel */}
      <div className="app-panel p-6 md:p-8">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="mt-3 h-10 w-2/3 rounded-xl" />
        <Skeleton className="mt-4 h-4 w-1/2 rounded-full" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* Two-col content sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="app-panel p-6">
          <Skeleton className="h-5 w-40 rounded-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="app-panel p-6">
          <Skeleton className="h-5 w-40 rounded-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
