"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BuildingSwitcher } from "./building-switcher";

interface Building {
  id: string;
  name: string;
  suburb: string;
}

interface TopbarProps {
  buildings: Building[];
}

export function Topbar({ buildings }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      <div className="w-60">
        <BuildingSwitcher buildings={buildings} />
      </div>

      <div className="relative ml-auto flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search residents, units..."
          className="pl-9"
        />
      </div>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          3
        </span>
      </Button>
    </header>
  );
}
