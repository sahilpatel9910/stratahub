import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentRentLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Hero panel */}
      <Skeleton className="h-52 rounded-2xl" />
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      {/* Payment table */}
      <div className="app-panel overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
