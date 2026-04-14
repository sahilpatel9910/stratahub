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
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/70 px-5 py-5">
        <Link href="/resident" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/15">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-[-0.03em] text-sidebar-foreground">StrataHub</p>
            <p className="text-xs text-sidebar-foreground/60">Resident portal</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[0.68rem] uppercase tracking-[0.18em] text-sidebar-foreground/45">
            Resident Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {residentNavItems.map((item) => (
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
