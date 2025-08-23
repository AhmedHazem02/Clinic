'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating AI-assisted prescription phrases.
 *
 * The flow takes patient details and desired effect as input and returns suggested prescription phrases.
 * @exports generatePrescriptionPhrases - The main function to trigger the prescription phrase generation flow.
 * @exports AiAssistedPrescriptionInput - The input type for the generatePrescriptionPhrases function.
 * @exports AiAssistedPrescriptionOutput - The output type for the generatePrescriptionPhrases function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiAssistedPrescriptionInputSchema = z.object({
  patientName: z.string().describe('The name of the patient.'),
  patientDetails: z.string().describe('Relevant details about the patient, including symptoms and medical history.'),
  desiredEffect: z.string().describe('The desired effect of the prescription.'),
});

export type AiAssistedPrescriptionInput = z.infer<typeof AiAssistedPrescriptionInputSchema>;

const AiAssistedPrescriptionOutputSchema = z.object({
  prescriptionPhrases: z.array(z.string()).describe('An array of suggested prescription phrases.'),
});

export type AiAssistedPrescriptionOutput = z.infer<typeof AiAssistedPrescriptionOutputSchema>;

export async function generatePrescriptionPhrases(input: AiAssistedPrescriptionInput): Promise<AiAssistedPrescriptionOutput> {
  return aiAssistedPrescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiAssistedPrescriptionPrompt',
  input: {schema: AiAssistedPrescriptionInputSchema},
  output: {schema: AiAssistedPrescriptionOutputSchema},
  prompt: `You are a medical expert. Generate a list of prescription phrases for the following patient.

Patient Name: {{{patientName}}}
Patient Details: {{{patientDetails}}}
Desired Effect: {{{desiredEffect}}}

Provide 3 example phrases.`,
});

const aiAssistedPrescriptionFlow = ai.defineFlow(
  {
    name: 'aiAssistedPrescriptionFlow',
    inputSchema: AiAssistedPrescriptionInputSchema,
    outputSchema: AiAssistedPrescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
