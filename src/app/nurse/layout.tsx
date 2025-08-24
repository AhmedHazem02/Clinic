import { NurseProfileProvider } from "@/components/nurse/nurse-profile-provider";
import { NurseSidebarNav } from "@/components/nurse/nurse-sidebar-nav";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NurseProfileProvider>
      <SidebarProvider>
        <Sidebar>
          <NurseSidebarNav />
        </Sidebar>
        <SidebarInset>
          <header className="p-4 sm:p-6 lg:p-8 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold font-headline">Nurse Panel</h1>
          </header>
          <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NurseProfileProvider>
  );
}
