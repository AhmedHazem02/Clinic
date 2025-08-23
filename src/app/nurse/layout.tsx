import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Home, UserPlus, Settings, Stethoscope } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
                <Stethoscope className="w-8 h-8 text-primary" />
                <h1 className="font-headline text-2xl font-semibold">QueueWise</h1>
            </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/nurse/dashboard" isActive>
                <Home />
                Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <UserPlus />
                Register Patient
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src="https://placehold.co/40x40.png" alt="@nursesmith" data-ai-hint="nurse avatar" />
                    <AvatarFallback>NS</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-semibold">Nurse Smith</span>
                    <span className="text-xs text-muted-foreground">Registered Nurse</span>
                </div>
            </div>
          <SignOutButton />
        </SidebarFooter>
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
  );
}
