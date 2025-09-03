
"use client";

import { LogOut } from "lucide-react";
import { signOutUser } from "@/services/authClientService";
import { useRouter } from "next/navigation";

export function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await signOutUser();
        router.push('/login');
    }

    // Render as a child of DropdownMenuItem
    return (
        <button className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-destructive/10 text-destructive font-medium w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> 
            <span>تسجيل الخروج</span>
        </button>
    )
}
