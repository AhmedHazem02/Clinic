
"use server";

import { admin } from "@/lib/firebaseAdmin";
import type { DoctorProfile } from "./queueService";

// Set/Update a doctor's profile using the Admin SDK for server-side operations
export const setDoctorProfile = async (uid: string, profile: Partial<DoctorProfile>) => {
    const adminDb = admin().firestore();
    const docRef = adminDb.collection('doctors').doc(uid);
    return await docRef.set(profile, { merge: true });
}
