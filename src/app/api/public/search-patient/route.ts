/**
 * Public Patient Search API Route
 * 
 * Server-side endpoint for searching active patients by phone number.
 * Uses Firebase Admin SDK to bypass Firestore security rules.
 * 
 * POST /api/public/search-patient
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      ok: true,
      found: true,
      patient: {
        id: patientDoc.id,
        clinicId: patientData.clinicId,
        doctorId: patientData.doctorId,
        ticketId: patientData.ticketId,
        name: patientData.name,
        phone: patientData.phone,
        queueNumber: patientData.queueNumber,
        status: patientData.status,
        queueType: patientData.queueType,
      },
    });

  } catch (error) {
    console.error('Error searching for patient:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
