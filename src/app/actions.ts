"use server";

import {
  generatePrescriptionPhrases,
  type AiAssistedPrescriptionInput,
  type AiAssistedPrescriptionOutput,
} from "@/ai/flows/ai-assisted-prescription";
import { createNurseUser } from "@/services/authService";

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
        await createNurseUser(email, password);
        return { success: true, message: "Nurse account created successfully." };
    } catch (error: any) {
        console.error("Error creating nurse user:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}
