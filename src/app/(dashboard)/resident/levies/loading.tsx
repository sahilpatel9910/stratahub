import { Skeleton } from "@/components/ui/skeleton";

export default function LeviesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-8 w-32 rounded-xl" />
      {/* Outstanding balance card */}
      <Skeleton className="h-28 rounded-2xl" />
      {/* Table sections */}
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="app-panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-40 rounded-full" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 rounded-full" />
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
