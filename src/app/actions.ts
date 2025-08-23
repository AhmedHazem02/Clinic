"use server";

import {
  generatePrescriptionPhrases,
  type AiAssistedPrescriptionInput,
  type AiAssistedPrescriptionOutput,
} from "@/ai/flows/ai-assisted-prescription";

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
