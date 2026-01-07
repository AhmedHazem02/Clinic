/**
 * Clinic Public Service
 * 
 * Public-facing clinic operations for patient self-booking.
 * These functions do not require authentication.
 */

import { getFirebase } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { Clinic, Doctor } from "@/types/multitenant";

/**
 * Get clinic by slug
 * Used in public booking flows to identify the clinic
 * 
 * @param slug - Clinic URL slug
 * @returns Promise resolving to clinic or null if not found
 */
export async function getClinicBySlug(slug: string): Promise<Clinic | null> {
  const { db } = getFirebase();
  const clinicsCollection = collection(db, 'clinics');

  const q = query(
    clinicsCollection,
    where('slug', '==', slug),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const clinicDoc = snapshot.docs[0];
  return { id: clinicDoc.id, ...clinicDoc.data() } as Clinic;
}

/**
 * Get clinic by ID
 * 
 * @param clinicId - Clinic document ID
 * @returns Promise resolving to clinic or null if not found
 */
export async function getClinicById(clinicId: string): Promise<Clinic | null> {
  const { db } = getFirebase();
  const clinicRef = doc(db, 'clinics', clinicId);

  const clinicSnap = await getDoc(clinicRef);
  if (!clinicSnap.exists()) {
    return null;
  }

  return { id: clinicSnap.id, ...clinicSnap.data() } as Clinic;
}

/**
 * List all active doctors for a clinic
 *
 * @deprecated Single doctor model: Each clinic has exactly ONE doctor (the owner).
 * Use clinic.ownerUid to get the doctor ID instead.
 * This function is kept for backward compatibility only.
 *
 * @param clinicId - Clinic document ID
 * @returns Promise resolving to array of doctors (will always return 1 doctor)
 */
export async function listActiveDoctorsForClinic(clinicId: string): Promise<Doctor[]> {
  const { db } = getFirebase();
  const doctorsCollection = collection(db, 'doctors');

  const q = query(
    doctorsCollection,
    where('clinicId', '==', clinicId),
    where('isActive', '==', true),
    orderBy('name')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
}

/**
 * Get doctor by ID
 * 
 * @param doctorId - Doctor document ID
 * @returns Promise resolving to doctor or null if not found
 */
export async function getDoctorById(doctorId: string): Promise<Doctor | null> {
  const { db } = getFirebase();
  const doctorRef = doc(db, 'doctors', doctorId);

  const doctorSnap = await getDoc(doctorRef);
  if (!doctorSnap.exists()) {
    return null;
  }

  return { id: doctorSnap.id, ...doctorSnap.data() } as Doctor;
}

/**
 * Validate phone number format (Egyptian format)
 * 
 * @param phone - Phone number to validate
 * @returns True if valid
 */
export function validatePhoneNumber(phone: string): boolean {
  // Egyptian phone: 11 digits starting with 01
  const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
  const cleanPhone = phone.replace(/\D/g, '');
  return phoneRegex.test(cleanPhone);
}

/**
 * Check if patient already has an active booking today
 * Prevents double-booking
 * 
 * @param phone - Patient phone number
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @returns Promise resolving to existing ticket ID or null
 */
export async function checkExistingBooking(
  phone: string,
  clinicId: string,
  doctorId: string
): Promise<string | null> {
  const { db } = getFirebase();
  const patientsCollection = collection(db, 'patients');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q = query(
    patientsCollection,
    where('phone', '==', phone),
    where('clinicId', '==', clinicId),
    where('doctorId', '==', doctorId),
    where('status', 'in', ['Waiting', 'Consulting'])
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  // Check if any booking is for today
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const bookingDate = data.bookingDate?.toDate?.() || new Date(data.bookingDate);
    
    if (bookingDate.toDateString() === today.toDateString()) {
      // Return ticket ID if available
      return data.ticketId || doc.id;
    }
  }

  return null;
}
