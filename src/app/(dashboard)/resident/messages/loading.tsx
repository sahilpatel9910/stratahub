import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentMessagesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl">
      <div className="flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-2xl border border-border">
        {/* Thread list */}
        <div className="w-72 shrink-0 border-r border-border p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        {/* Message area placeholder */}
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}
