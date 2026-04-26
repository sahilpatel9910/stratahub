import { Skeleton } from "@/components/ui/skeleton";

export default function AnnouncementsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="app-panel p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-56 rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg ml-4 shrink-0" />
            </div>
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
