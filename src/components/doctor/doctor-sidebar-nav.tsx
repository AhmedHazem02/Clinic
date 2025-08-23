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
import Link from 'next/link';

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
                  <Link href="/doctor/dashboard">
                    <SidebarMenuButton isActive={pathname === '/doctor/dashboard'}>
                      <Home />
                      Dashboard
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="#">
                    <SidebarMenuButton>
                      <User />
                      Patient History
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/doctor/settings">
                    <SidebarMenuButton isActive={pathname === '/doctor/settings'}>
                      <Settings />
                      Settings
                    </SidebarMenuButton>
                  </Link>
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
