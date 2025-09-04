
"use server";

import { revalidatePath } from "next/cache";
import { setDoc, doc, getDoc, deleteDoc } from "firebase/firestore";
import { admin } from "@/lib/firebaseAdmin"; // Using admin SDK for server-side operations
import { PatientInQueue, DoctorProfile } from "@/services/queueService";
import { z } from "zod";

const PatientReportSchema = z.object({
    patientName: z.string(),
    doctorName: z.string(),
    consultationReason: z.string(),
    chronicDiseases: z.string(),
    prescription: z.string(),
    bookingDate: z.string(),
});

type PatientReport = z.infer<typeof PatientReportSchema>;

export async function generatePatientReport(reportData: PatientReport) {
    // In a real app, this would generate a PDF or a formatted document.
    // For this example, we'll just return a success message.
    console.log("Generating report for:", reportData.patientName);
    return { success: true, message: "Report generated successfully." };
}

export async function setDoctorAvailability(uid: string, isAvailable: boolean) {
    if (!uid) {
        return { success: false, message: "User ID is required." };
    }

    try {
        const db = admin().firestore();
        const docRef = doc(db, "doctors", uid);
        await setDoc(docRef, { isAvailable }, { merge: true });
        
        // Revalidate the path to ensure the UI updates
        revalidatePath("/doctor/dashboard");
        
        return { success: true, message: `Availability set to ${isAvailable}.` };
    } catch (error) {
        console.error("Error updating availability:", error);
        return { success: false, message: "Failed to update availability status." };
    }
}

export async function deletePatientAction(patientId: string) {
    if (!patientId) {
        return { success: false, error: "Patient ID is required." };
    }
    try {
        const db = admin().firestore();
        const patientDocRef = doc(db, 'patients', patientId);
        await deleteDoc(patientDocRef);
        revalidatePath('/doctor/history'); // Revalidate the history page to show the change
        return { success: true };
    } catch (error) {
        console.error("Error deleting patient:", error);
        return { success: false, error: "Failed to delete patient." };
    }
}
