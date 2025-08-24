"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthChange, type User } from "@/services/authClientService";
import { getDoctorProfile, type DoctorProfile } from "@/services/queueService";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "../ui/skeleton";

interface DoctorProfileContextType {
    user: User | null;
    profile: DoctorProfile | null;
    isLoading: boolean;
}

const DoctorProfileContext = createContext<DoctorProfileContextType | undefined>(undefined);

export function DoctorProfileProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribeAuth = onAuthChange(async (authUser) => {
            if (authUser) {
                setUser(authUser);
                const doctorProfile = await getDoctorProfile(authUser.uid);
                if (doctorProfile) {
                    setProfile(doctorProfile);
                    if (pathname === '/doctor/onboarding') {
                        router.replace('/doctor/dashboard');
                    }
                } else if (pathname !== '/doctor/onboarding') {
                     router.replace('/doctor/onboarding');
                }
            } else {
                setUser(null);
                setProfile(null);
                router.replace('/login');
            }
            setIsLoading(false);
        });

        return () => unsubscribeAuth();
    }, [router, pathname]);

    if (isLoading || (!profile && pathname !== '/doctor/onboarding')) {
        return (
            <div className="flex h-screen items-center justify-center">
               <div className="space-y-4">
                 <Skeleton className="h-12 w-12 rounded-full" />
                 <Skeleton className="h-4 w-[250px]" />
                 <Skeleton className="h-4 w-[200px]" />
               </div>
            </div>
        )
    }

    return (
        <DoctorProfileContext.Provider value={{ user, profile, isLoading }}>
            {children}
        </DoctorProfileContext.Provider>
    );
}

export function useDoctorProfile() {
    const context = useContext(DoctorProfileContext);
    if (context === undefined) {
        throw new Error("useDoctorProfile must be used within a DoctorProfileProvider");
    }
    return context;
}
