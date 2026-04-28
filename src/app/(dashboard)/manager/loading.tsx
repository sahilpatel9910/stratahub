import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerDashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* Hero panel — 2-col: heading + compact metrics / building health card */}
      <div className="app-panel p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          <div>
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="mt-3 h-10 w-3/4 rounded-xl" />
            <Skeleton className="mt-4 h-4 w-1/2 rounded-full" />
            {/* 4 compact metric chips inside hero */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>

      {/* 4 StatPanel cards below hero */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* Two-col section: operational focus + announcements */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="app-panel p-6">
          <Skeleton className="h-5 w-40 rounded-full mb-5" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="app-panel p-6">
          <Skeleton className="h-5 w-44 rounded-full mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Wide maintenance section */}
      <div className="app-panel p-6">
        <Skeleton className="h-5 w-52 rounded-full mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
