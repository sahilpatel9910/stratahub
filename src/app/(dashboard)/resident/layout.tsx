import { SidebarProvider } from "@/components/ui/sidebar";
import { ResidentSidebar } from "@/components/layout/resident-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TRPCProvider } from "@/lib/trpc/provider";
import { Toaster } from "@/components/ui/sonner";

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <ResidentSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar buildings={[]} />
            <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </TRPCProvider>
  );
}
