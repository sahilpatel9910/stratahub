import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentMaintenanceLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-4 w-20 rounded-full ml-4 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
