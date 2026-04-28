import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentAnnouncementsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-8 w-44 rounded-xl" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="app-panel p-5 space-y-2">
            <Skeleton className="h-5 w-64 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
