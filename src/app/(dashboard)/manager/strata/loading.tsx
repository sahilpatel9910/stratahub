import { Skeleton } from "@/components/ui/skeleton";

export default function StrataLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {/* Tabs */}
      <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
      {/* Content area */}
      <div className="app-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
