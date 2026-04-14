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
  { title: "Financials", href: "/manager/financials", icon: DollarSign },
  { title: "Analytics", href: "/manager/analytics", icon: BarChart3 },
];

const adminNavItems = [
  { title: "Organisations", href: "/super-admin/organisations", icon: Shield },
  { title: "Buildings", href: "/super-admin/buildings", icon: Building2 },
  { title: "Users", href: "/super-admin/users", icon: Users },
];

export function AppSidebar({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = isSuperAdmin;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/70 px-5 py-5">
        <Link href="/manager" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/15">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-[-0.03em] text-sidebar-foreground">StrataHub</p>
            <p className="text-xs text-sidebar-foreground/60">Building operations</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {isAdmin && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 text-[0.68rem] uppercase tracking-[0.18em] text-sidebar-foreground/45">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      className="h-10 rounded-xl px-3 text-sidebar-foreground/72 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
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
          <SidebarGroupLabel className="px-3 text-[0.68rem] uppercase tracking-[0.18em] text-sidebar-foreground/45">
            Property Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {managerNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    className="h-10 rounded-xl px-3 text-sidebar-foreground/72 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
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

      <SidebarFooter className="border-t border-sidebar-border/70 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/manager/settings" />}
              className="h-10 rounded-xl px-3 text-sidebar-foreground/72 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="h-10 rounded-xl px-3 text-sidebar-foreground/72 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
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
