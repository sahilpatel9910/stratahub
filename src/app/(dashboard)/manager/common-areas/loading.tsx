import { Skeleton } from "@/components/ui/skeleton";

export default function CommonAreasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="app-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48 rounded-full" />
            <Skeleton className="h-4 w-32 rounded-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
