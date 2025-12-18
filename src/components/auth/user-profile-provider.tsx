"use client";

/**
 * User Profile Provider
 *
 * Provides user authentication state and profile information.
 * This is the foundational auth context for the multi-tenant system.
 *
 * Usage:
 * - Wrap your app or specific routes with this provider
 * - Use the useUserProfile hook to access user and profile data
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthChange } from "@/services/authClientService";
import {
  getUserProfileWithLegacyFallback,
  updateLastLogin,
  isLegacyProfile,
} from "@/services/userProfileService";
import type { User } from "firebase/auth";
import type { UserProfile, LegacyUserProfile } from "@/types/multitenant";

interface UserProfileContextValue {
  user: User | null;
  userProfile: UserProfile | LegacyUserProfile | null;
  isLoading: boolean;
  error: string | null;
  isLegacy: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined
);

interface UserProfileProviderProps {
  children: ReactNode;
  requireAuth?: boolean;           // If true, redirect to /login if not authenticated
  redirectTo?: string;              // Custom redirect path if not authenticated
}

export function UserProfileProvider({
  children,
  requireAuth = false,
  redirectTo = '/login',
}: UserProfileProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | LegacyUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      setIsLoading(true);
      setError(null);

      if (!authUser) {
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);

        if (requireAuth) {
          router.push(redirectTo);
        }
        return;
      }

      setUser(authUser);

      try {
        // Fetch user profile with legacy fallback
        const profile = await getUserProfileWithLegacyFallback(authUser.uid);

        if (!profile) {
          setUserProfile(null);
          setError('Profile not found. Please contact support or complete onboarding.');
          setIsLoading(false);
          return;
        }

        setUserProfile(profile);

        // Update last login timestamp (non-blocking)
        if (!isLegacyProfile(profile)) {
          updateLastLogin(authUser.uid).catch(err =>
            console.warn('Failed to update last login:', err)
          );
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError('Failed to load user profile');
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [requireAuth, redirectTo, router]);

  const value: UserProfileContextValue = {
    user,
    userProfile,
    isLoading,
    error,
    isLegacy: userProfile ? isLegacyProfile(userProfile) : false,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

/**
 * Hook to access user profile context
 *
 * @throws Error if used outside of UserProfileProvider
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

/**
 * Helper hook to get role-specific routing
 *
 * Returns the default dashboard path for the user's role
 */
export function useRoleDashboardPath(): string | null {
  const { userProfile, isLegacy } = useUserProfile();

  if (!userProfile) return null;

  if (isLegacy) {
    // Legacy users route based on their old role
    const legacyProfile = userProfile as LegacyUserProfile;
    return legacyProfile.role === 'doctor' ? '/doctor/dashboard' : '/nurse/dashboard';
  }

  // Modern users route based on userProfile role
  const modernProfile = userProfile as UserProfile;
  switch (modernProfile.role) {
    case 'owner':
      return '/admin/dashboard';
    case 'doctor':
      return '/doctor/dashboard';
    case 'nurse':
      return '/nurse/dashboard';
    default:
      return null;
  }
}
