
"use client";

import Link from "next/link";
import { LogOut, Stethoscope } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "../ui/button";

export function NurseHeader() {

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center space-x-4 px-4 sm:justify-between sm:space-x-0 sm:px-8">
                <div className="flex flex-1 items-center justify-start space-x-4">
                   <SignOutButton />
                </div>
                <div className="flex gap-6 md:gap-10">
                    <Link href="/nurse/dashboard" className="flex items-center space-x-2">
                        <Stethoscope className="h-6 w-6 text-primary" />
                        <span className="inline-block font-bold">عيادة QueueWise</span>
                    </Link>
                </div>
            </div>
        </header>
    );
}
