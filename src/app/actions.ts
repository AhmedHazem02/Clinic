
"use server";

import {
  generatePrescriptionPhrases,
  type AiAssistedPrescriptionInput,
  type AiAssistedPrescriptionOutput,
} from "@/ai/flows/ai-assisted-prescription";
import { createUser } from "@/services/authService";
import { getPatientsForLast30Days, getClinicSettings, getAllDoctors } from "@/services/queueService";
import { setDoctorProfile, removePatientFromQueueAdmin } from "@/services/queueService.admin";
import { format } from "date-fns";
import { ar } from 'date-fns/locale';
import { auth } from "@/lib/firebase";
import { getAuth } from "firebase-admin/auth";
import { admin } from "@/lib/firebaseAdmin";

export async function getAiPrescriptionSuggestions(
  input: AiAssistedPrescriptionInput
): Promise<AiAssistedPrescriptionOutput> {
  try {
    const result = await generatePrescriptionPhrases(input);
    return result;
  } catch (error) {
    console.error("Error generating AI prescription phrases:", error);
    // In a real app, you might want to return a more user-friendly error
    throw new Error("Failed to generate AI suggestions. Please try again.");
  }
}

export async function addNurseAction(email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
        await createUser(email, password, 'nurse');
        return { success: true, message: "Nurse account created successfully." };
    } catch (error: any) {
        console.error("Error creating nurse user:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}

async function getCurrentDoctorId(): Promise<string> {
    // This is a placeholder for getting the current user's ID on the server.
    // In a real app with proper session management, you'd get this from the session.
    // For now, let's assume a hardcoded ID for a single doctor scenario.
    // To make this multi-tenant, you would need to pass the doctor's ID from the client.
    // For this example, we'll try to get it, but it might not be available in all server action contexts.
    // A more robust solution would involve session management.
    const authUser = auth.currentUser; // This works on the client, but might be null in server actions
    if(authUser) return authUser.uid;

    // This is a fallback and might not be secure or reliable.
    // It's better to pass the UID from the client-side component that calls this action.
    // We will assume for now that there is a way to identify the doctor.
    // If you have a single doctor, you can hardcode their ID.
    // For multi-doctor, you MUST pass the doctor's ID to this function.
    
    // Let's assume you pass the doctor ID to the action
    // For now, returning a placeholder or throwing error.
    console.warn("Could not determine current doctor ID on the server.");
    return "default-doctor-id"; // PLEASE REPLACE
}


export async function generatePatientReport(doctorId: string): Promise<string> {
  try {
    const patients = await getPatientsForLast30Days(doctorId);
    const settings = await getClinicSettings();
    const doctors = await getAllDoctors();
    
    // Assuming single doctor and location for now
    const clinicLocation = doctors.length > 0 && doctors[0].locations.length > 0 
      ? doctors[0].locations[0] 
      : "غير متوفر";

    if (patients.length === 0) {
      return "لا توجد بيانات مرضى لآخر 30 يومًا.";
    }

    const consultationCost = settings?.consultationCost ?? 0;
    const reConsultationCost = settings?.reConsultationCost ?? 0;

    // Group patients by date and calculate daily revenue
    const dailyData = patients.reduce((acc, p) => {
        const date = p.bookingDate; // This is a Date object from getPatientsForLast30Days
        const dateStr = format(date, "yyyy-MM-dd");
        if (!acc[dateStr]) {
            acc[dateStr] = { patients: [], revenue: 0, date: date };
        }
        acc[dateStr].patients.push(p);
        if (p.status === 'Finished') {
            const cost = p.queueType === 'Re-consultation' ? reConsultationCost : consultationCost;
            acc[dateStr].revenue += cost;
        }
        return acc;
    }, {} as Record<string, { patients: typeof patients, revenue: number, date: Date }>);

    const totalRevenue = Object.values(dailyData).reduce((sum, day) => sum + day.revenue, 0);

    const today = new Date();
    const reportDate = format(today, "d/M/yyyy");
    let reportContent = `تقرير المرضى - آخر 30 يومًا (${reportDate})\n`;
    reportContent += "============================================================\n\n";
    
    // Add daily revenue section
    reportContent += "ملخص الإيرادات اليومية:\n";
    Object.values(dailyData).forEach((data) => {
      reportContent += `${format(data.date, 'EEEE, d MMMM yyyy', { locale: ar })}: ${data.revenue.toFixed(2)} جنيه\n`;
    });
    reportContent += `\nإجمالي الإيرادات: ${totalRevenue.toFixed(2)} جنيه\n`;
    reportContent += "----------------------------------------\n\n";


    // Add patient details
    let patientCounter = 1;
    Object.values(dailyData).forEach(({ patients: dailyPatients }) => {
        dailyPatients.forEach(p => {
            reportContent += `رقم المريض: ${patientCounter}\n`;
            reportContent += `الاسم: ${p.name}\n`;
            reportContent += `العمر: ${p.age || 'غير متوفر'}\n`;
            reportContent += `الهاتف: ${p.phone}\n`;
            reportContent += `الموقع: ${clinicLocation}\n`;
            reportContent += `الأمراض المزمنة: ${p.chronicDiseases || 'لا يوجد'}\n`;
            reportContent += `الحالة: ${p.status}\n`;
            reportContent += `رقم الاستشارة: #${p.queueNumber}\n`;
            reportContent += `تاريخ الحجز: ${format(p.bookingDate, "yyyy-MM-dd")}\n`;
            reportContent += "----------------------------------------\n";
            patientCounter++;
        });
    });

    return reportContent;

  } catch (error) {
    console.error("Error generating patient report:", error);
    throw new Error("Failed to generate patient report.");
  }
}

export async function setDoctorAvailability(uid: string, isAvailable: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        await setDoctorProfile(uid, { isAvailable });
        return { success: true };
    } catch (error: any) {
        console.error("Error in setDoctorAvailability action:", error.message);
        // This is a critical configuration error. The developer needs to know about it.
        if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
             return { success: false, error: "Server configuration error: Firebase Admin SDK is not initialized. Please check server logs." };
        }
        return { success: false, error: "Failed to update availability status." };
    }
}

export async function deletePatientAction(patientId: string) {
    try {
        await removePatientFromQueueAdmin(patientId);
        return { success: true };
    } catch (error) {
        console.error("Error deleting patient:", error);
        return { success: false, error: "Failed to delete patient." };
    }
}
