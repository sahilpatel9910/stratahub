"use client";

import { useState } from "react";
import { Bell, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BuildingSwitcher } from "./building-switcher";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter, usePathname } from "next/navigation";

interface Building {
  id: string;
  name: string;
  suburb: string;
  organisationName: string;
}

interface TopbarProps {
  buildings: Building[];
}

export function Topbar({ buildings }: TopbarProps) {
  const [bellOpen, setBellOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdminPage = pathname.startsWith("/super-admin");

  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: notifications = [] } = trpc.notifications.listRecent.useQuery(
    { limit: 15 },
    { enabled: bellOpen }
  );

  const utils = trpc.useUtils();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.listRecent.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.listRecent.invalidate();
    },
  });

  function handleNotificationClick(id: string, isRead: boolean, linkUrl?: string | null) {
    if (!isRead) markRead.mutate({ id });
    setBellOpen(false);
    if (linkUrl) router.push(linkUrl);
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      {!isSuperAdminPage && (
        <div className="w-60">
          <BuildingSwitcher buildings={buildings} />
        </div>
      )}

      <div className="relative ml-auto flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search residents, units..."
          className="pl-9"
        />
      </div>

      {/* Notification Bell */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setBellOpen((o) => !o)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>

        {bellOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setBellOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border bg-white shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.isRead, n.linkUrl)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && (
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                        <div className={!n.isRead ? "" : "ml-4"}>
                          <p className={`text-sm ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
