/**
 * User Profile Service
 *
 * Manages user profiles in the multi-tenant system.
 * Provides backward compatibility for legacy users during migration.
 */

import { getFirebase } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import type { UserProfile, LegacyUserProfile } from "@/types/multitenant";

/**
 * Get user profile by Firebase Auth UID
 *
 * @param uid - Firebase Auth UID
 * @returns UserProfile if found, null if not found
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const { db } = getFirebase();
    const profileRef = doc(db, 'userProfiles', uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const data = profileSnap.data();
      return {
        uid: profileSnap.id,
        email: data.email || '',
        displayName: data.displayName || '',
        clinicId: data.clinicId,
        role: data.role,
        doctorId: data.doctorId,
        nurseId: data.nurseId,
        isActive: data.isActive ?? true,
        createdAt: data.createdAt,
        lastLoginAt: data.lastLoginAt,
        invitedBy: data.invitedBy,
        invitedAt: data.invitedAt,
        acceptedAt: data.acceptedAt,
      } as UserProfile;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Detect legacy user profile by checking old doctors/nurses collections
 *
 * This function provides backward compatibility during migration.
 * It does NOT write to the database - just reads legacy data.
 *
 * @param uid - Firebase Auth UID
 * @returns LegacyUserProfile if legacy user found, null otherwise
 */
export async function detectLegacyProfile(uid: string): Promise<LegacyUserProfile | null> {
  try {
    const { db } = getFirebase();

    // Check if user exists in legacy doctors collection
    const doctorRef = doc(db, 'doctors', uid);
    const doctorSnap = await getDoc(doctorRef);

    if (doctorSnap.exists()) {
      const doctorData = doctorSnap.data();
      return {
        uid,
        role: 'doctor',
        isLegacy: true,
        displayName: doctorData.name || 'Doctor',
        email: doctorData.email || '',
      };
    }

    // Check if user exists in legacy nurses collection
    const nurseRef = doc(db, 'nurses', uid);
    const nurseSnap = await getDoc(nurseRef);

    if (nurseSnap.exists()) {
      const nurseData = nurseSnap.data();
      return {
        uid,
        role: 'nurse',
        isLegacy: true,
        displayName: nurseData.name || 'Nurse',
        email: nurseData.email || '',
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting legacy profile:', error);
    return null;
  }
}

/**
 * Get user profile with legacy fallback
 *
 * First tries to get modern userProfile, then falls back to legacy detection.
 * This ensures existing users can continue to use the system during migration.
 *
 * @param uid - Firebase Auth UID
 * @returns UserProfile, LegacyUserProfile, or null
 */
export async function getUserProfileWithLegacyFallback(
  uid: string
): Promise<UserProfile | LegacyUserProfile | null> {
  // Try modern profile first
  const profile = await getUserProfile(uid);
  if (profile) {
    return profile;
  }

  // Fall back to legacy detection
  const legacyProfile = await detectLegacyProfile(uid);
  if (legacyProfile) {
    console.warn(
      `User ${uid} is using legacy profile. Migration to userProfiles needed.`
    );
    return legacyProfile;
  }

  return null;
}

/**
 * Update last login timestamp for a user profile
 *
 * @param uid - Firebase Auth UID
 */
export async function updateLastLogin(uid: string): Promise<void> {
  try {
    const { db } = getFirebase();
    const profileRef = doc(db, 'userProfiles', uid);

    // Check if profile exists before updating
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      await setDoc(
        profileRef,
        { lastLoginAt: Timestamp.now() },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('Error updating last login:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Type guard to check if profile is legacy
 *
 * @param profile - UserProfile or LegacyUserProfile
 * @returns true if profile is legacy
 */
export function isLegacyProfile(
  profile: UserProfile | LegacyUserProfile | null
): profile is LegacyUserProfile {
  return profile !== null && 'isLegacy' in profile && profile.isLegacy === true;
}

/**
 * Type guard to check if profile is modern (has clinicId)
 *
 * @param profile - UserProfile or LegacyUserProfile
 * @returns true if profile is modern UserProfile
 */
export function isModernProfile(
  profile: UserProfile | LegacyUserProfile | null
): profile is UserProfile {
  return profile !== null && 'clinicId' in profile && !('isLegacy' in profile);
}

/**
 * Create a new user profile
 *
 * @param uid - Firebase Auth UID
 * @param profileData - User profile data
 */
export async function createUserProfile(
  uid: string,
  profileData: {
    email: string;
    displayName: string;
    clinicId: string;
    role: 'owner' | 'doctor' | 'nurse';
    doctorId?: string;
    nurseId?: string;
    invitedBy?: string;
  }
): Promise<void> {
  try {
    const { db } = getFirebase();
    const profileRef = doc(db, 'userProfiles', uid);

    const userProfile: any = {
      email: profileData.email,
      displayName: profileData.displayName,
      clinicId: profileData.clinicId,
      role: profileData.role,
      isActive: true,
      createdAt: Timestamp.now(),
    };

    // Only add optional fields if they are defined (avoid undefined in Firestore)
    if (profileData.doctorId !== undefined) {
      userProfile.doctorId = profileData.doctorId;
    }
    if (profileData.nurseId !== undefined) {
      userProfile.nurseId = profileData.nurseId;
    }
    if (profileData.invitedBy !== undefined) {
      userProfile.invitedBy = profileData.invitedBy;
      userProfile.acceptedAt = Timestamp.now();
    }

    await setDoc(profileRef, userProfile);
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}
