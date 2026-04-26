import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <Skeleton className="h-8 w-28 rounded-xl" />
      {/* Profile section */}
      <div className="app-panel p-6 space-y-5">
        <Skeleton className="h-5 w-32 rounded-full" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-[10px]" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-[10px]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-11 w-full rounded-[10px]" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      {/* Notifications section */}
      <div className="app-panel p-6 space-y-4">
        <Skeleton className="h-5 w-44 rounded-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-3 w-56 rounded-full" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
