
"use client";

import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { useNurseProfile } from "./nurse-profile-provider";

export function NurseHeader() {
    const { profile } = useNurseProfile();

    const getInitials = (name: string = "") => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("");
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center space-x-4 px-4 sm:justify-between sm:space-x-0 sm:px-8">
                <div className="flex gap-6 md:gap-10">
                    <Link href="/nurse/dashboard" className="flex items-center space-x-2">
                        <Stethoscope className="h-6 w-6 text-primary" />
                        <span className="inline-block font-bold font-headline">عيادة QueueWise</span>
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-end space-x-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Avatar className="cursor-pointer">
                                <AvatarImage 
                                    src={profile?.avatarUrl || "https://placehold.co/40x40.png"}
                                    alt={profile?.name}
                                    data-ai-hint="nurse avatar"
                                />
                                <AvatarFallback>{getInitials(profile?.name)}</AvatarFallback>
                            </Avatar>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/nurse/profile">الملف الشخصي</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <DropdownMenuItem asChild>
                               <SignOutButton />
                             </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
