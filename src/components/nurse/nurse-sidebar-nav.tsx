"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, UserPlus, Settings, Stethoscope } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";
import { useNurseProfile } from "./nurse-profile-provider";

export function NurseSidebarNav() {
  const pathname = usePathname();
  const { profile } = useNurseProfile();

  const getInitials = (name: string = "") => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  };

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
            <Link href="/nurse/dashboard">
              <SidebarMenuButton isActive={pathname === "/nurse/dashboard"}>
                <Home />
                Dashboard
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          {/* These items are placeholders for now */}
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
        {profile && (
            <Link
            href="/nurse/profile"
            className="rounded-md p-2 -m-2 hover:bg-secondary/50 transition-colors"
            >
            <div className="flex items-center gap-3">
                <Avatar>
                <AvatarImage
                    src={profile.avatarUrl || "https://placehold.co/40x40.png"}
                    alt={profile.name}
                    data-ai-hint="nurse avatar"
                />
                <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                <span className="font-semibold">{profile.name}</span>
                <span className="text-xs text-muted-foreground">
                    Registered Nurse
                </span>
                </div>
            </div>
            </Link>
        )}
        <SignOutButton />
      </SidebarFooter>
    </>
  );
}
