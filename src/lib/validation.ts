/**
 * Input Validation Utilities
 * 
 * Centralized validation and sanitization functions for user inputs.
 */

import { z } from 'zod';

// =============================================================================
// Phone Number Validation
// =============================================================================

/**
 * Validate Egyptian phone number format
 * Accepts: 01XXXXXXXXX (11 digits starting with 01)
 */
export function validateEgyptianPhone(phone: string): boolean {
  const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
  const cleanPhone = phone.replace(/\D/g, '');
  return phoneRegex.test(cleanPhone);
}

/**
 * Sanitize phone number - remove non-digits
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 11);
}

// =============================================================================
// Text Sanitization
// =============================================================================

/**
 * Sanitize text input - remove potentially harmful characters
 * Allows Arabic, English letters, numbers, and common punctuation
 */
export function sanitizeText(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    // Remove control characters and potentially harmful chars
    .replace(/[\x00-\x1F\x7F<>]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize name - more restrictive for names
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    // Allow Arabic, English, spaces, and common name characters
    .replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z\s\-'.]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Limit length
    .slice(0, 100);
}

// =============================================================================
// Zod Schemas for API Validation
// =============================================================================

/**
 * Booking request validation schema
 */
export const bookingSchema = z.object({
  clinicSlug: z.string().min(1).max(100).optional(),
  clinicId: z.string().min(1).max(100).optional(),
  doctorId: z.string().min(1).max(100).optional(),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .transform(sanitizeName),
  phone: z.string()
    .refine(validateEgyptianPhone, 'Invalid Egyptian phone number'),
  age: z.union([
    z.string().regex(/^\d{1,3}$/).transform(Number),
    z.number().min(0).max(150),
  ]).optional().nullable(),
  queueType: z.enum(['Consultation', 'Re-consultation']).default('Consultation'),
  consultationReason: z.string().max(500).transform((val) => sanitizeText(val, 500)).optional().nullable(),
  chronicDiseases: z.string().max(500).transform((val) => sanitizeText(val, 500)).optional().nullable(),
  source: z.enum(['patient', 'nurse']).default('patient'),
  nurseId: z.string().min(1).max(100).optional().nullable(),
  nurseName: z.string().max(100).transform(sanitizeName).optional().nullable(),
});

/**
 * Search patient request validation schema
 */
export const searchPatientSchema = z.object({
  phone: z.string()
    .min(1, 'Phone number is required')
    .refine(validateEgyptianPhone, 'Invalid phone number format'),
  ticketId: z.string().min(1).max(100).optional(),
});

/**
 * Queue count request validation schema
 */
export const queueCountSchema = z.object({
  clinicSlug: z.string().min(1).max(100),
  doctorId: z.string().min(1).max(100),
});

// =============================================================================
// Validation Helper Functions
// =============================================================================

/**
 * Validate request body against a Zod schema
 * Returns parsed data or throws validation error
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: 'Invalid request data' };
  }
}

/**
 * Check if a string looks like a potential XSS attack
 */
export function containsXSS(text: string): boolean {
  if (!text) return false;
  
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(text));
}

/**
 * Validate and sanitize clinic slug
 */
export function validateClinicSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  // Allow lowercase letters, numbers, and hyphens
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug) && slug.length <= 100;
}
