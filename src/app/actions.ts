"use server";

import {
  generatePrescriptionPhrases,
  type AiAssistedPrescriptionInput,
  type AiAssistedPrescriptionOutput,
} from "@/ai/flows/ai-assisted-prescription";
import { createUser } from "@/services/authService";
import { getPatientsForLast30Days, setDoctorAvailability as setDoctorAvailabilityDb } from "@/services/queueService";
import { format } from "date-fns";

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

export async function setDoctorAvailability(uid: string, isAvailable: boolean) {
  return await setDoctorAvailabilityDb(uid, isAvailable);
}

export async function generatePatientReportCsv(): Promise<string> {
  try {
    const patients = await getPatientsForLast30Days();

    if (patients.length === 0) {
      return "No patient data found for the last 30 days.";
    }

    // Define CSV headers
    const headers = [
      "QueueNumber",
      "Name",
      "Phone",
      "BookingDate",
      "Status",
      "QueueType",
      "ConsultationReason",
      "ChronicDiseases",
      "Age",
      "RegisteredBy",
    ];

    // Convert patient data to CSV rows
    const rows = patients.map(p => [
      p.queueNumber,
      `"${p.name.replace(/"/g, '""')}"`,
      p.phone,
      format(p.bookingDate, "yyyy-MM-dd"),
      p.status,
      p.queueType,
      `"${(p.consultationReason || 'N/A').replace(/"/g, '""')}"`,
      `"${(p.chronicDiseases || 'N/A').replace(/"/g, '""')}"`,
      p.age || 'N/A',
      `"${(p.nurseName || 'N/A').replace(/"/g, '""')}"`
    ].join(','));

    // Combine headers and rows
    return [headers.join(','), ...rows].join('\n');

  } catch (error) {
    console.error("Error generating patient report:", error);
    throw new Error("Failed to generate patient report.");
  }
}