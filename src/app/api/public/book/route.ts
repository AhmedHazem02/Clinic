/**
 * Public Booking API Route
 * 
 * Server-side endpoint for secure patient self-booking.
 * Uses Firebase Admin SDK to bypass Firestore security rules.
 * 
 * POST /api/public/book
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// Validation helpers
function validateEgyptianPhone(phone: string): boolean {
  const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
  const cleanPhone = phone.replace(/\D/g, '');
  return phoneRegex.test(cleanPhone);
}

function sanitizeDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0) + '.';
  return parts.map(part => part.charAt(0)).join('.') + '.';
}

function getPhoneLast4(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return digits;
  return digits.slice(-4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clinicSlug,
      doctorId,
      name,
      phone,
      age,
      queueType = 'Consultation',
      consultationReason,
      chronicDiseases,
    } = body;

    // Validate required fields
    if (!clinicSlug || typeof clinicSlug !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'clinicSlug is required' },
        { status: 400 }
      );
    }

    if (!doctorId || typeof doctorId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'doctorId is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: 'name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!phone || !validateEgyptianPhone(phone)) {
      return NextResponse.json(
        { ok: false, error: 'invalid phone number format' },
        { status: 400 }
      );
    }

    const db = adminDb();

    // Lookup clinic by slug
    const clinicsRef = db.collection('clinics');
    const clinicQuery = await clinicsRef
      .where('slug', '==', clinicSlug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (clinicQuery.empty) {
      return NextResponse.json(
        { ok: false, error: 'clinic not found or inactive' },
        { status: 404 }
      );
    }

    const clinicDoc = clinicQuery.docs[0];
    const clinicId = clinicDoc.id;
    const clinicData = clinicDoc.data();

    // Verify doctor belongs to clinic and is active
    const doctorRef = db.collection('doctors').doc(doctorId);
    const doctorSnap = await doctorRef.get();

    if (!doctorSnap.exists) {
      return NextResponse.json(
        { ok: false, error: 'doctor not found' },
        { status: 404 }
      );
    }

    const doctorData = doctorSnap.data()!;
    if (doctorData.clinicId !== clinicId) {
      return NextResponse.json(
        { ok: false, error: 'doctor does not belong to this clinic' },
        { status: 400 }
      );
    }

    if (!doctorData.isActive) {
      return NextResponse.json(
        { ok: false, error: 'doctor is not active' },
        { status: 400 }
      );
    }

    // Check for existing booking today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const patientsRef = db.collection('patients');
    const existingQuery = await patientsRef
      .where('phone', '==', phone)
      .where('clinicId', '==', clinicId)
      .where('doctorId', '==', doctorId)
      .where('bookingDate', '>=', todayTimestamp)
      .get();

    // Check if any existing booking is active
    for (const doc of existingQuery.docs) {
      const data = doc.data();
      if (data.status === 'Waiting' || data.status === 'Consulting') {
        // Patient already has active booking
        if (data.ticketId) {
          return NextResponse.json({
            ok: true,
            ticketId: data.ticketId,
            alreadyBooked: true,
          });
        }
      }
    }

    // Get next queue number for this doctor today
    const queueQuery = await patientsRef
      .where('doctorId', '==', doctorId)
      .where('clinicId', '==', clinicId)
      .where('bookingDate', '>=', todayTimestamp)
      .orderBy('bookingDate', 'desc')
      .orderBy('queueNumber', 'desc')
      .limit(1)
      .get();

    let queueNumber = 1;
    if (!queueQuery.empty) {
      const lastPatient = queueQuery.docs[0].data();
      queueNumber = (lastPatient.queueNumber || 0) + 1;
    }

    // Check if patient should be re-consultation
    let finalQueueType = queueType;
    if (queueType === 'Re-consultation') {
      // Check if patient has history with this doctor
      const historyQuery = await patientsRef
        .where('phone', '==', phone)
        .where('doctorId', '==', doctorId)
        .limit(1)
        .get();

      if (historyQuery.empty) {
        // No history, force to Consultation
        finalQueueType = 'Consultation';
      }
    }

    // Create patient document
    const now = Timestamp.now();
    const bookingDateTimestamp = Timestamp.fromDate(new Date());
    
    const patientData = {
      name: name.trim(),
      phone: phone.trim(),
      bookingDate: bookingDateTimestamp,
      age: age ? parseInt(age, 10) : null,
      chronicDiseases: chronicDiseases || null,
      consultationReason: consultationReason || null,
      queueType: finalQueueType,
      doctorId,
      clinicId,
      source: 'patient',
      queueNumber,
      status: 'Waiting',
      createdAt: now,
      prescription: '',
      nurseId: null,
      nurseName: null,
    };

    const patientRef = await patientsRef.add(patientData);
    const patientId = patientRef.id;

    // Create booking ticket
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const ticketData = {
      clinicId,
      doctorId,
      patientId,
      queueNumber,
      status: 'Waiting',
      displayName: sanitizeDisplayName(name),
      phoneLast4: getPhoneLast4(phone),
      createdAt: now,
      expiresAt: Timestamp.fromDate(endOfDay),
    };

    const ticketRef = await db.collection('bookingTickets').add(ticketData);
    const ticketId = ticketRef.id;

    // Update patient with ticketId
    await patientRef.update({ ticketId });

    return NextResponse.json({
      ok: true,
      ticketId,
      alreadyBooked: false,
      queueNumber,
    });

  } catch (error: any) {
    console.error('Booking API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
