import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      {/* Notification list */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-xl border border-border p-4">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-64 rounded-full" />
              <Skeleton className="h-3 w-40 rounded-full" />
            </div>
            <Skeleton className="h-3 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
