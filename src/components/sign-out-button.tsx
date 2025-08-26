
"use client";

import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { signOutUser } from "@/services/authClientService";
import { usePathname, useRouter } from "next/navigation";
import { setDoctorAvailability } from "@/app/actions";
import { auth } from "@/lib/firebase";

export function SignOutButton() {
    const router = useRouter();
    const pathname = usePathname();

    const handleSignOut = async () => {
        const user = auth.currentUser;
        if (user) {
            // Check if the user is a doctor before setting availability.
            if (pathname?.startsWith('/doctor')) {
                 await setDoctorAvailability(user.uid, false);
            }
        }
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
