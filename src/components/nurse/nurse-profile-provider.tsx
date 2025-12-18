"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthChange, type User } from "@/services/authClientService";
import { getNurseProfile, type NurseProfile } from "@/services/queueService";
import { useRouter } from "next/navigation";
import { Skeleton } from "../ui/skeleton";
import { getUserProfileWithLegacyFallback, isLegacyProfile } from "@/services/userProfileService";
import type { UserProfile, LegacyUserProfile } from "@/types/multitenant";

interface NurseProfileContextType {
    user: User | null;
    profile: NurseProfile | null;
    userProfile: UserProfile | LegacyUserProfile | null;  // Added: multi-tenant profile
    isLoading: boolean;
}

const NurseProfileContext = createContext<NurseProfileContextType | undefined>(undefined);

export function NurseProfileProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<NurseProfile | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | LegacyUserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

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

                // Check if user has nurse role
                const isNurse = isLegacyProfile(fetchedUserProfile)
                    ? fetchedUserProfile.role === 'nurse'
                    : fetchedUserProfile.role === 'nurse';

                if (!isNurse) {
                    // User is not a nurse - redirect to login
                    console.warn('User is not a nurse, redirecting to login');
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

                // Fetch nurse profile
                // For legacy users, use their UID (old system)
                // For modern users, use their nurseId if available
                const nurseIdToUse = isLegacyProfile(fetchedUserProfile)
                    ? authUser.uid
                    : (fetchedUserProfile.nurseId || authUser.uid);

                console.log('🔍 Fetching nurse profile:', {
                    nurseIdToUse,
                    isLegacy: isLegacyProfile(fetchedUserProfile),
                    userProfile: fetchedUserProfile
                });

                const nurseProfile = await getNurseProfile(nurseIdToUse);

                if (nurseProfile) {
                    console.log('✅ Nurse profile found:', {
                        ...nurseProfile,
                        hasClinicId: !!nurseProfile.clinicId,
                        clinicIdValue: nurseProfile.clinicId
                    });
                    
                    // Auto-fix: If nurse profile missing clinicId, add it from userProfile
                    const userClinicId = 'clinicId' in fetchedUserProfile ? fetchedUserProfile.clinicId : undefined;
                    if (!nurseProfile.clinicId && userClinicId) {
                        console.warn('⚠️ Nurse profile missing clinicId, auto-fixing...');
                        const { setNurseProfile } = await import('@/services/queueService');
                        await setNurseProfile(nurseIdToUse, {
                            clinicId: userClinicId,
                            isActive: true,
                        });
                        // Update local copy
                        nurseProfile.clinicId = userClinicId;
                        nurseProfile.isActive = true;
                        console.log('✅ Nurse profile fixed with clinicId:', userClinicId);
                    }
                    
                    // Check if nurse profile is active
                    if (nurseProfile.isActive === false) {
                        console.warn('Nurse profile is inactive, logging out');
                        const { signOutUser } = await import('@/services/authClientService');
                        await signOutUser();
                        router.replace('/login?message=تم إيقاف حسابك من قبل الإدارة');
                        setIsLoading(false);
                        return;
                    }
                    setProfile(nurseProfile);
                } else {
                    console.warn('❌ No nurse profile found in DB, creating temp profile');
                    // Fallback: create a temporary profile from auth user if none in DB
                    // This is a common scenario for legacy users
                    const tempProfile: NurseProfile = {
                        name: authUser.displayName || fetchedUserProfile.displayName || 'Nurse',
                        email: authUser.email || fetchedUserProfile.email || '',
                    };
                    setProfile(tempProfile);
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
        <NurseProfileContext.Provider value={{ user, profile, userProfile, isLoading: false }}>
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
