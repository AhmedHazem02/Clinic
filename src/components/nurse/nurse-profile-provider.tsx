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
                setProfile(nurseProfile);
            } else {
                setUser(null);
                setProfile(null);
                router.replace('/login');
            }
            setIsLoading(false);
        });

        return () => unsubscribeAuth();
    }, [router]);

    if (isLoading) {
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
        <NurseProfileContext.Provider value={{ user, profile, isLoading }}>
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
