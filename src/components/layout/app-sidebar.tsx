"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Home,
  Key,
  DollarSign,
  Wrench,
  UserCheck,
  Package,
  Megaphone,
  FileText,
  MessageSquare,
  BarChart3,
  Landmark,
  DoorOpen,
  Settings,
  Shield,
  LogOut,
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

const managerNavItems = [
  { title: "Dashboard", href: "/manager", icon: Home },
  { title: "Residents", href: "/manager/residents", icon: Users },
  { title: "Units", href: "/manager/units", icon: Building2 },
  { title: "Rent", href: "/manager/rent", icon: DollarSign },
  { title: "Keys & Access", href: "/manager/keys", icon: Key },
  { title: "Maintenance", href: "/manager/maintenance", icon: Wrench },
  { title: "Visitors", href: "/manager/visitors", icon: UserCheck },
  { title: "Parcels", href: "/manager/parcels", icon: Package },
  { title: "Announcements", href: "/manager/announcements", icon: Megaphone },
  { title: "Documents", href: "/manager/documents", icon: FileText },
  { title: "Messages", href: "/manager/messages", icon: MessageSquare },
  { title: "Strata", href: "/manager/strata", icon: Landmark },
  { title: "Common Areas", href: "/manager/common-areas", icon: DoorOpen },
  { title: "Financials", href: "/manager/financials", icon: DollarSign },
  { title: "Analytics", href: "/manager/analytics", icon: BarChart3 },
];

const receptionNavItems = [
  { title: "Visitors", href: "/manager/visitors", icon: UserCheck },
  { title: "Parcels", href: "/manager/parcels", icon: Package },
  { title: "Keys & Access", href: "/manager/keys", icon: Key },
  { title: "Maintenance", href: "/manager/maintenance", icon: Wrench },
  { title: "Messages", href: "/manager/messages", icon: MessageSquare },
] as const;

const adminNavItems = [
  { title: "Organisations", href: "/super-admin/organisations", icon: Shield },
  { title: "Buildings", href: "/super-admin/buildings", icon: Building2 },
  { title: "Users", href: "/super-admin/users", icon: Users },
];

export function AppSidebar({
  isSuperAdmin = false,
  isReceptionOnly = false,
}: {
  isSuperAdmin?: boolean;
  isReceptionOnly?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = isSuperAdmin;
  const propertyNavItems = isReceptionOnly ? receptionNavItems : managerNavItems;
  const homeHref = isReceptionOnly ? "/manager/visitors" : "/manager";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar variant="floating" className="border-r-0">
      <SidebarHeader className="sidebar-surface border-b border-sidebar-border/70 px-5 py-5">
        <Link href={homeHref} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(6,182,212,0.92),rgba(37,99,235,0.9))] text-white shadow-[0_16px_36px_-20px_rgba(34,211,238,0.8)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-[-0.04em] text-sidebar-foreground">StrataHub</p>
            <p className="text-xs tracking-[0.08em] text-sidebar-foreground/58">
              {isReceptionOnly ? "Reception operations" : "Building operations"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="sidebar-surface px-3 py-4">
        {isAdmin && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="sidebar-section-label">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {adminNavItems.map((item) => (
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="p-0 pt-4">
          <SidebarGroupLabel className="sidebar-section-label">
            Property Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {propertyNavItems.map((item) => (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="sidebar-surface border-t border-sidebar-border/70 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/manager/settings" />}
              className="sidebar-nav-button"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
