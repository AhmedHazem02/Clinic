"use client";

import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { signOutUser } from "@/services/authService";
import { useRouter } from "next/navigation";

export function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await signOutUser();
        router.push('/login');
    }

    return (
        <Button variant="ghost" className="w-full justify-start mt-2" onClick={handleSignOut}>
            <LogOut className="mr-2" /> Logout
        </Button>
    )
}
