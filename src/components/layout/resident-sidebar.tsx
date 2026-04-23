"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  DollarSign,
  Wrench,
  FileText,
  Megaphone,
  MessageSquare,
  LogOut,
  DoorOpen,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const residentNavItems = [
  { title: "My Home", href: "/resident", icon: Home },
  { title: "My Levies", href: "/resident/levies", icon: DollarSign },
  { title: "Maintenance", href: "/resident/maintenance", icon: Wrench },
  { title: "Common Areas", href: "/resident/common-areas", icon: DoorOpen },
  { title: "Documents", href: "/resident/documents", icon: FileText },
  { title: "Announcements", href: "/resident/announcements", icon: Megaphone },
  { title: "Settings", href: "/resident/settings", icon: Settings },
];

export function ResidentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { data: unreadCount } = trpc.messaging.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar variant="floating" className="border-r-0">
      <SidebarHeader className="sidebar-surface border-b border-sidebar-border/70 px-5 py-5">
        <Link href="/resident" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(6,182,212,0.92),rgba(37,99,235,0.9))] text-white shadow-[0_16px_36px_-20px_rgba(34,211,238,0.8)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em] text-sidebar-foreground">StrataHub</p>
            <p className="text-xs tracking-[0.08em] text-sidebar-foreground/58">Resident portal</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="sidebar-surface px-3 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="sidebar-section-label">
            Resident Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {residentNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    className="sidebar-nav-button"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/resident/messages" />}
                  isActive={pathname === "/resident/messages"}
                  className="sidebar-nav-button"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Messages</span>
                  {!!unreadCount && unreadCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="sidebar-surface border-t border-sidebar-border/70 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="sidebar-nav-button"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
