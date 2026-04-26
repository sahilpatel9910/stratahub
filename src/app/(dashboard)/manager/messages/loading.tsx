import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl">
      <div className="flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-2xl border border-border">
        {/* Thread list */}
        <div className="w-80 shrink-0 border-r border-border p-3 space-y-2">
          <Skeleton className="h-10 w-full rounded-lg mb-3" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="h-3 w-36 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        {/* Message area */}
        <div className="flex flex-1 flex-col">
          <div className="border-b border-border p-4">
            <Skeleton className="h-5 w-40 rounded-full" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <Skeleton className={`h-14 rounded-2xl ${i % 2 === 0 ? "w-64" : "w-52"}`} />
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
