/**
 * Clinic Service
 *
 * Manages clinic operations in the multi-tenant system.
 */

import { getFirebase } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc, getDocs, query, where, Timestamp, addDoc } from "firebase/firestore";
import type { Clinic } from "@/types/multitenant";

/**
 * Check if a clinic slug is available
 *
 * @param slug - The slug to check
 * @returns true if available, false if taken
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const { db } = getFirebase();
  const clinicsRef = collection(db, 'clinics');
  const q = query(clinicsRef, where('slug', '==', slug.toLowerCase()));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

/**
 * Create a new clinic
 *
 * @param clinicData - Clinic information
 * @param ownerUid - Firebase Auth UID of the clinic owner
 * @returns The created clinic with ID
 */
export async function createClinic(
  clinicData: {
    name: string;
    slug: string;
  },
  ownerUid: string
): Promise<Clinic> {
  const { db } = getFirebase();

  // Verify slug is available
  const slugAvailable = await isSlugAvailable(clinicData.slug);
  if (!slugAvailable) {
    throw new Error('Clinic slug is already taken');
  }

  const clinicsRef = collection(db, 'clinics');
  const now = Timestamp.now();

  const newClinic: Omit<Clinic, 'id'> = {
    name: clinicData.name,
    slug: clinicData.slug.toLowerCase(),
    ownerUid,
    ownerId: ownerUid, // For compatibility
    ownerName: '', // Will be updated from user profile
    ownerEmail: '', // Will be updated from user profile
    createdAt: now,
    updatedAt: now,
    isActive: true,
    settings: {
      consultationTime: 15,
      consultationCost: 200,
      reConsultationCost: 100,
      timezone: 'Africa/Cairo',
      language: 'ar',
    },
    phoneNumbers: [],
    locations: [],
  };

  const docRef = await addDoc(clinicsRef, newClinic);

  return {
    ...newClinic,
    id: docRef.id,
  };
}

/**
 * Get a clinic by ID
 *
 * @param clinicId - The clinic ID
 * @returns The clinic or null if not found
 */
export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const { db } = getFirebase();
  const clinicRef = doc(db, 'clinics', clinicId);
  const clinicSnap = await getDoc(clinicRef);

  if (!clinicSnap.exists()) {
    return null;
  }

  return {
    id: clinicSnap.id,
    ...clinicSnap.data(),
  } as Clinic;
}

/**
 * Get a clinic by slug
 *
 * @param slug - The clinic slug
 * @returns The clinic or null if not found
 */
export async function getClinicBySlug(slug: string): Promise<Clinic | null> {
  const { db } = getFirebase();
  const clinicsRef = collection(db, 'clinics');
  const q = query(clinicsRef, where('slug', '==', slug.toLowerCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const clinicDoc = snapshot.docs[0];
  return {
    id: clinicDoc.id,
    ...clinicDoc.data(),
  } as Clinic;
}

/**
 * Update clinic information
 *
 * @param clinicId - The clinic ID
 * @param updates - Fields to update
 */
export async function updateClinic(
  clinicId: string,
  updates: Partial<Clinic>
): Promise<void> {
  const { db } = getFirebase();
  const clinicRef = doc(db, 'clinics', clinicId);

  await setDoc(
    clinicRef,
    {
      ...updates,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}
