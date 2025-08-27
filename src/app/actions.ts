
"use server";

import {
  generatePrescriptionPhrases,
  type AiAssistedPrescriptionInput,
  type AiAssistedPrescriptionOutput,
} from "@/ai/flows/ai-assisted-prescription";
import { createUser } from "@/services/authService";
import { getPatientsForLast30Days, getClinicSettings, getAllDoctors, setDoctorProfile, removePatientFromQueue } from "@/services/queueService";
import { format } from "date-fns";
import { ar } from 'date-fns/locale';

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

export async function generatePatientReport(): Promise<string> {
  try {
    const patients = await getPatientsForLast30Days();
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

export async function setDoctorAvailability(uid: string, isAvailable: boolean) {
  try {
    await setDoctorProfile(uid, { isAvailable });
  } catch (error) {
    console.error("Error setting doctor availability:", error);
    throw new Error("Failed to update doctor availability.");
  }
}

export async function deletePatientAction(patientId: string) {
    try {
        await removePatientFromQueue(patientId);
    } catch (error) {
        console.error("Error deleting patient:", error);
        throw new Error("Failed to delete patient.");
    }
}
