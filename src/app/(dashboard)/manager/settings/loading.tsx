import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <Skeleton className="h-8 w-32 rounded-xl" />
      {/* Avatar section */}
      <div className="app-panel p-6 flex items-center gap-5">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-4 w-52 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-lg mt-2" />
        </div>
      </div>
      {/* Form fields */}
      <div className="app-panel p-6 space-y-5">
        <Skeleton className="h-5 w-28 rounded-full" />
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
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-11 w-full rounded-[10px]" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-11 w-full rounded-[10px]" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}
