
"use server";

import { admin } from "@/lib/firebaseAdmin";
import type { DoctorProfile } from "./queueService";

// Set/Update a doctor's profile using the Admin SDK for server-side operations
export const setDoctorProfile = async (uid: string, profile: Partial<DoctorProfile>) => {
    // Call admin() to get the initialized instance
    const adminDb = admin().firestore();
    const docRef = adminDb.collection('doctors').doc(uid);
    return await docRef.set(profile, { merge: true });
}

// Remove a patient from the queue (server-side admin)
export const removePatientFromQueueAdmin = async (patientId: string) => {
    const adminDb = admin().firestore();
    const patientDocRef = adminDb.collection('patients').doc(patientId);
    return await patientDocRef.delete();
};
