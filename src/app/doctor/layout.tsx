import { DoctorSidebarNav } from "@/components/doctor/doctor-sidebar-nav";
import { Sidebar, SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DoctorProfileProvider } from "@/components/doctor/doctor-profile-provider";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DoctorProfileProvider>
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <DoctorSidebarNav />
        </Sidebar>
        <SidebarInset>
          <header className="p-4 sm:p-6 lg:p-8 flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-3xl font-bold font-headline">Doctor Panel</h1>
          </header>
          <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-0">
              {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DoctorProfileProvider>
  );
}
