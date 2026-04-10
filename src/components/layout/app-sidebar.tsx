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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = pathname.startsWith("/super-admin");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/manager" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold">StrataHub</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
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

        <SidebarGroup>
          <SidebarGroupLabel>Property Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managerNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
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

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/manager/settings" />}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
