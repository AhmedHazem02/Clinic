/**
 * Public Patient Search API Route
 * 
 * Server-side endpoint for searching active patients by phone number.
 * Uses Firebase Admin SDK to bypass Firestore security rules.
 * 
 * SECURITY: Only returns minimal information (ticketId) to prevent data scraping.
 * Full patient details require the ticketId for verification.
 * 
 * POST /api/public/search-patient
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { checkRateLimit, getClientId, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';
import { logger, sanitizeErrorMessage } from '@/lib/logger';
import { searchPatientSchema, validateRequestBody } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientId(request);
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.search);
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for patient search', { clientId });
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate input
    const validation = validateRequestBody(searchPatientSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const { phone } = validation.data;

    const db = adminDb();
    
    // Search for active patient with this phone number
    const patientsRef = db.collection('patients');
    const snapshot = await patientsRef
      .where('phone', '==', phone)
      .where('status', 'in', ['Waiting', 'Consulting'])
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        ok: true,
        found: false,
      });
    }

    const patientDoc = snapshot.docs[0];
    const patientData = patientDoc.data();

    // SECURITY: Only return minimal information
    // The ticketId is required to view full status page
    return NextResponse.json({
      ok: true,
      found: true,
      patient: {
        ticketId: patientData.ticketId,
        clinicId: patientData.clinicId,
        // Only return queue position info, not personal details
        queueNumber: patientData.queueNumber,
        status: patientData.status,
      },
    });

  } catch (error: unknown) {
    logger.error('Error searching for patient', error);
    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
