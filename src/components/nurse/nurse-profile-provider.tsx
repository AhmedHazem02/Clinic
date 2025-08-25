"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthChange, type User } from "@/services/authClientService";
import { getNurseProfile, type NurseProfile } from "@/services/queueService";
import { useRouter } from "next/navigation";
import { Skeleton } from "../ui/skeleton";

interface NurseProfileContextType {
    user: User | null;
    profile: NurseProfile | null;
    isLoading: boolean;
}

const NurseProfileContext = createContext<NurseProfileContextType | undefined>(undefined);

export function NurseProfileProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<NurseProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = onAuthChange(async (authUser) => {
            if (authUser) {
                setUser(authUser);
                const nurseProfile = await getNurseProfile(authUser.uid);
                // Ensure profile exists. If not, user might be a doctor or another role.
                if (nurseProfile) {
                    setProfile(nurseProfile);
                } else {
                    // Fallback: create a temporary profile from auth user if none in DB
                    // This is a common scenario if a nurse logs in but doesn't have a DB record yet
                    const tempProfile: NurseProfile = {
                        name: authUser.displayName || 'Nurse',
                        email: authUser.email || '',
                    };
                    setProfile(tempProfile);
                }
            } else {
                setUser(null);
                setProfile(null);
                router.replace('/login');
            }
            setIsLoading(false);
        });

        return () => unsubscribeAuth();
    }, [router]);

    if (isLoading || !profile) {
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
        <NurseProfileContext.Provider value={{ user, profile, isLoading: false }}>
            {children}
        </NurseProfileContext.Provider>
    );
}

export function useNurseProfile() {
    const context = useContext(NurseProfileContext);
    if (context === undefined) {
        throw new Error("useNurseProfile must be used within a NurseProfileProvider");
    }
    return context;
}
