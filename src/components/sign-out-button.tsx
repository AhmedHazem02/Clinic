"use client";

import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { signOutUser } from "@/services/authClientService";
import { useRouter } from "next/navigation";
import { setDoctorAvailability } from "@/app/actions";
import { auth } from "@/lib/firebase";

export function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        const user = auth.currentUser;
        if (user) {
            // Check if the user is a doctor before setting availability.
            // This is a simple check; a more robust solution would use custom claims.
            if (router.pathname?.startsWith('/doctor')) {
                 await setDoctorAvailability(user.uid, false);
            }
        }
        await signOutUser();
        router.push('/login');
    }

    return (
        <Button variant="ghost" className="w-full justify-start mt-2" onClick={handleSignOut}>
            <LogOut className="mr-2" /> Logout
        </Button>
    )
}
