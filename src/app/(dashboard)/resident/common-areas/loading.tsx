import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentCommonAreasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-8 w-40 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="app-panel p-5 space-y-3">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-4 w-48 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
