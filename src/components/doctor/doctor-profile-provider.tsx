"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthChange, type User } from "@/services/authClientService";
import { getDoctorProfile, type DoctorProfile } from "@/services/queueService";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "../ui/skeleton";
import { getUserProfileWithLegacyFallback, isLegacyProfile } from "@/services/userProfileService";
import type { UserProfile, LegacyUserProfile } from "@/types/multitenant";

interface DoctorProfileContextType {
    user: User | null;
    profile: DoctorProfile | null;
    userProfile: UserProfile | LegacyUserProfile | null;  // Added: multi-tenant profile
    isLoading: boolean;
}

const DoctorProfileContext = createContext<DoctorProfileContextType | undefined>(undefined);

export function DoctorProfileProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | LegacyUserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribeAuth = onAuthChange(async (authUser) => {
            if (authUser) {
                setUser(authUser);

                // Fetch user profile (multi-tenant or legacy)
                const fetchedUserProfile = await getUserProfileWithLegacyFallback(authUser.uid);

                if (!fetchedUserProfile) {
                    // No profile found - redirect to login
                    setUser(null);
                    setProfile(null);
                    setUserProfile(null);
                    router.replace('/login');
                    setIsLoading(false);
                    return;
                }

                // Check if user has doctor role
                const isDoctor = isLegacyProfile(fetchedUserProfile)
                    ? fetchedUserProfile.role === 'doctor'
                    : (fetchedUserProfile.role === 'doctor' || fetchedUserProfile.role === 'owner');

                if (!isDoctor) {
                    // User is not a doctor - redirect to their appropriate dashboard
                    console.warn('User is not a doctor, redirecting to login');
                    router.replace('/login');
                    setIsLoading(false);
                    return;
                }

                // Check if user account is active
                if (!isLegacyProfile(fetchedUserProfile) && fetchedUserProfile.isActive === false) {
                    // Account has been deactivated - force logout
                    console.warn('User account is inactive, logging out');
                    const { signOutUser } = await import('@/services/authClientService');
                    await signOutUser();
                    router.replace('/login?message=تم إيقاف حسابك من قبل الإدارة');
                    setIsLoading(false);
                    return;
                }

                setUserProfile(fetchedUserProfile);

                // Fetch doctor profile
                // For legacy users, use their UID (old system)
                // For modern users, use their doctorId if available
                const doctorIdToUse = isLegacyProfile(fetchedUserProfile)
                    ? authUser.uid
                    : (fetchedUserProfile.doctorId || authUser.uid);

                const doctorProfile = await getDoctorProfile(doctorIdToUse);

                if (doctorProfile) {
                    // Check if doctor profile is active
                    if (doctorProfile.isActive === false) {
                        console.warn('Doctor profile is inactive, logging out');
                        const { signOutUser } = await import('@/services/authClientService');
                        await signOutUser();
                        router.replace('/login?message=تم إيقاف حسابك من قبل الإدارة');
                        setIsLoading(false);
                        return;
                    }
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
                setUserProfile(null);
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
        <DoctorProfileContext.Provider value={{ user, profile, userProfile, isLoading }}>
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
