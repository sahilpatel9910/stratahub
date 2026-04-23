"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Bell,
  DollarSign,
  Wrench,
  Megaphone,
  Package,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { NotificationType } from "@/generated/prisma/client";

// ─── Type → Icon mapping ──────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: NotificationType }) {
  const cls = "h-5 w-5 shrink-0";
  switch (type) {
    case "LEVY_CREATED":
      return <DollarSign className={cls} />;
    case "MAINTENANCE_STATUS_UPDATED":
    case "MAINTENANCE_CREATED":
      return <Wrench className={cls} />;
    case "ANNOUNCEMENT_PUBLISHED":
      return <Megaphone className={cls} />;
    case "PARCEL_RECEIVED":
      return <Package className={cls} />;
    case "INVITE_SENT":
      return <UserPlus className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

// ─── Filter pill config ───────────────────────────────────────────────────────

type FilterValue = NotificationType | "ALL";

const FILTER_PILLS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "ALL" },
  { label: "Levies", value: "LEVY_CREATED" },
  { label: "Maintenance Updates", value: "MAINTENANCE_STATUS_UPDATED" },
  { label: "New Requests", value: "MAINTENANCE_CREATED" },
  { label: "Announcements", value: "ANNOUNCEMENT_PUBLISHED" },
  { label: "Parcels", value: "PARCEL_RECEIVED" },
  { label: "Invites", value: "INVITE_SENT" },
];

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-6 py-4 border-b border-border/40 last:border-b-0"
        >
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
      <p className="mt-1 text-xs text-muted-foreground">
        No notifications to show right now.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerNotificationsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [activeType, setActiveType] = useState<FilterValue>("ALL");

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.notifications.listPaginated.useInfiniteQuery(
    {
      type: activeType === "ALL" ? undefined : activeType,
      limit: 20,
    },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }
  );

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.listPaginated.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.listPaginated.invalidate();
    },
  });

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  function handleRowClick(id: string, linkUrl: string | null) {
    markRead.mutate({ id });
    if (linkUrl) {
      router.push(linkUrl);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* ── Header panel ───────────────────────────────────────────────────── */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label">Manager Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Notifications
            </h1>
          </div>
          {unreadCount != null && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-8 shrink-0 rounded-lg text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? "Marking…" : "Mark all read"}
            </Button>
          )}
        </div>
      </section>

      {/* ── Filter pills ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-1">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setActiveType(pill.value)}
            className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
              activeType === pill.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Notifications list ─────────────────────────────────────────────── */}
      <section className="app-panel overflow-hidden">
        {isLoading ? (
          <SkeletonRows />
        ) : allItems.length === 0 ? (
          <EmptyState />
        ) : (
          allItems.map((n) => (
            <button
              key={n.id}
              onClick={() => handleRowClick(n.id, n.linkUrl)}
              className={`flex w-full items-start gap-3 border-b border-border/40 px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/30 ${
                !n.isRead ? "bg-primary/5" : ""
              }`}
            >
              {/* Unread indicator bar */}
              <div
                className={`mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full ${
                  !n.isRead ? "bg-primary" : "bg-transparent"
                }`}
              />

              {/* Icon */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  !n.isRead
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <NotificationIcon type={n.type} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    !n.isRead ? "text-foreground" : "text-foreground/80"
                  }`}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {n.body}
                  </p>
                )}
              </div>

              {/* Time */}
              <p className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </p>
            </button>
          ))
        )}
      </section>

      {/* ── Load more ──────────────────────────────────────────────────────── */}
      {hasNextPage && (
        <div className="flex justify-center pb-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
