import { Skeleton } from "@/components/ui/skeleton";

export default function MaintenanceDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Back link */}
      <Skeleton className="h-4 w-28 rounded-full" />
      {/* Header */}
      <div className="app-panel p-6 space-y-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-7 w-72 rounded-xl" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      {/* Status timeline */}
      <div className="app-panel p-6">
        <Skeleton className="h-5 w-32 rounded-full mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Comments */}
      <div className="app-panel p-6">
        <Skeleton className="h-5 w-24 rounded-full mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
