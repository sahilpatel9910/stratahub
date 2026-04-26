import { Skeleton } from "@/components/ui/skeleton";

export default function MaintenanceLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      {/* Tabs */}
      <Skeleton className="h-10 w-80 rounded-lg" />
      {/* Filter row */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      {/* Table */}
      <div className="app-panel overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded-full" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
