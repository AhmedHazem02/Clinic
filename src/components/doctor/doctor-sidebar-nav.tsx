"use client";

import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, User, Settings, Stethoscope } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export function DoctorSidebarNav() {
    const pathname = usePathname();

    return (
        <>
            <SidebarHeader className="p-4">
                <div className="flex items-center gap-3">
                    <Stethoscope className="w-8 h-8 text-primary" />
                    <h1 className="font-headline text-2xl font-semibold">QueueWise</h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/doctor/dashboard" isActive={pathname === '/doctor/dashboard'}>
                    <Home />
                    Dashboard
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton href="#">
                    <User />
                    Patient History
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/doctor/settings" isActive={pathname === '/doctor/settings'}>
                    <Settings />
                    Settings
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src="https://placehold.co/40x40.png" alt="@doctordoe" data-ai-hint="doctor avatar" />
                        <AvatarFallback>DD</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold">Dr. Jane Doe</span>
                        <span className="text-xs text-muted-foreground">Cardiologist</span>
                    </div>
                </div>
              <SignOutButton />
            </SidebarFooter>
        </>
    )
}
