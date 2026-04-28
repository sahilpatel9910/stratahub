import { Skeleton } from "@/components/ui/skeleton";

export default function OrganisationsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="app-panel overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded-full" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-40 rounded-full" />
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
