import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentNotificationsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-8 w-64 rounded-full" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
