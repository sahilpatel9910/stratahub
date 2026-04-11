"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  DollarSign,
  Wrench,
  FileText,
  Megaphone,
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
import { Building2 } from "lucide-react";

const residentNavItems = [
  { title: "My Home", href: "/resident", icon: Home },
  { title: "My Levies", href: "/resident/levies", icon: DollarSign },
  { title: "Maintenance", href: "/resident/maintenance", icon: Wrench },
  { title: "Documents", href: "/resident/documents", icon: FileText },
  { title: "Announcements", href: "/resident/announcements", icon: Megaphone },
];

export function ResidentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/resident" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold">StrataHub</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Resident Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {residentNavItems.map((item) => (
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
