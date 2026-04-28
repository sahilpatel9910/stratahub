import { Skeleton } from "@/components/ui/skeleton";

export default function RentLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="app-panel overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded-full" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
