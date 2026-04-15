import { SidebarProvider } from "@/components/ui/sidebar";
import { TRPCProvider } from "@/lib/trpc/provider";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <SidebarProvider>
        {children}
        <Toaster />
      </SidebarProvider>
    </TRPCProvider>
  );
}
