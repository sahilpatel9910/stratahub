"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Search, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BuildingSwitcher } from "./building-switcher";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter, usePathname } from "next/navigation";
import { useBuildingContext } from "@/hooks/use-building-context";

interface Building {
  id: string;
  name: string;
  suburb: string;
  organisationName: string;
}

interface TopbarProps {
  buildings: Building[];
  showBuildingSwitcher?: boolean;
  searchPlaceholder?: string;
  greetingName?: string | null;
  userInitials?: string | null;
  avatarUrl?: string | null;
}

export function Topbar({
  buildings,
  showBuildingSwitcher = true,
  searchPlaceholder = "Search residents, units, parcels...",
  greetingName,
  userInitials,
  avatarUrl,
}: TopbarProps) {
  const [bellOpen, setBellOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; right: number } | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { selectedBuildingId, setSelectedBuilding, clearSelectedBuilding } =
    useBuildingContext();
  const isSuperAdminPage = pathname.startsWith("/super-admin");
  const showGreeting = pathname === "/manager" && !!greetingName;
  const canShowBuildingSwitcher =
    showBuildingSwitcher && !isSuperAdminPage && buildings.length > 0;

  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined);
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

  useEffect(() => {
    if (selectedBuildingId && !buildings.some((building) => building.id === selectedBuildingId)) {
      clearSelectedBuilding();
      return;
    }

    if (buildings.length === 1) {
      const onlyBuilding = buildings[0];
      if (selectedBuildingId !== onlyBuilding.id) {
        setSelectedBuilding(onlyBuilding.id, onlyBuilding.name);
      }
    }
  }, [buildings, clearSelectedBuilding, selectedBuildingId, setSelectedBuilding]);

  useEffect(() => {
    function updatePanelPosition() {
      if (!bellButtonRef.current) return;
      const rect = bellButtonRef.current.getBoundingClientRect();
      setPanelStyle({
        top: rect.bottom + 12,
        right: Math.max(window.innerWidth - rect.right, 16),
      });
    }

    if (!bellOpen) return;

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [bellOpen]);

  function handleNotificationClick(id: string, isRead: boolean, linkUrl?: string | null) {
    if (!isRead) markRead.mutate({ id });
    setBellOpen(false);
    if (linkUrl) router.push(linkUrl);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-white/70 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-h-16 items-center gap-3">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="rounded-xl border border-white/70 bg-white/85 hover:bg-white" />
          <Separator orientation="vertical" className="hidden h-6 bg-border md:block" />
        </div>

        {showGreeting && (
          <div className="hidden min-w-0 lg:block">
            <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">
              Welcome, {greetingName}
            </p>
            <p className="text-xs text-muted-foreground">
              Here&apos;s your building snapshot for today.
            </p>
          </div>
        )}

        {canShowBuildingSwitcher && (
          <div className="hidden min-w-0 flex-1 xl:block">
            <BuildingSwitcher buildings={buildings} />
          </div>
        )}

        <div className="relative ml-auto flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            className="h-11 rounded-xl border-white/70 bg-white/85 pl-9 pr-4 shadow-none"
          />
        </div>

        <div className="relative">
          <Button
            ref={bellButtonRef}
            variant="ghost"
            size="icon"
            aria-label={bellOpen ? "Close notifications" : "Open notifications"}
            className="relative size-11 rounded-xl border border-white/70 bg-white/85 hover:bg-white"
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>

          {bellOpen && (
            <>
              {typeof document !== "undefined" &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setBellOpen(false)}
                    />

                    <div
                      className="fixed z-[70] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1rem] border border-border bg-popover shadow-[0_24px_48px_rgba(15,23,42,0.18)]"
                      style={{
                        top: panelStyle?.top ?? 80,
                        right: panelStyle?.right ?? 16,
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-border px-4 py-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Notifications</p>
                          <p className="text-xs text-muted-foreground">Latest building activity</p>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markAllRead.mutate()}
                            className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Check className="h-3 w-3" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n.id, n.isRead, n.linkUrl)}
                              className={`w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 ${!n.isRead ? "bg-muted/40" : ""}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${!n.isRead ? "bg-primary" : "bg-border"}`} />
                                <div className="min-w-0">
                                  <p className={`text-sm ${!n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                                    {n.title}
                                  </p>
                                  {n.body && (
                                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{n.body}</p>
                                  )}
                                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
            </>
          )}
        </div>

        {userInitials && (
          <button
            type="button"
            aria-label="Account settings"
            onClick={() => {
              const base = pathname.startsWith("/resident") ? "/resident" : "/manager";
              router.push(`${base}/settings`);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden text-xs font-semibold text-white transition-opacity hover:opacity-80"
            style={
              avatarUrl
                ? undefined
                : { background: "linear-gradient(135deg, oklch(0.58 0.11 195), oklch(0.39 0.06 245))" }
            }
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </button>
        )}
      </div>

      {canShowBuildingSwitcher && (
        <div className="mt-3 xl:hidden">
          <div className="rounded-2xl border border-white/70 bg-white/75 p-3 backdrop-blur-sm">
            <BuildingSwitcher buildings={buildings} />
          </div>
        </div>
      )}
    </header>
  );
}
