/**
 * Public Booking API Route
 * 
 * Server-side endpoint for secure patient self-booking.
 * Uses Firebase Admin SDK to bypass Firestore security rules.
 * 
 * POST /api/public/book
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, authAdmin } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { getCairoBookingDay } from '@/lib/bookingDay';
import { checkRateLimit, getClientId, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';
import { logger, sanitizeErrorMessage } from '@/lib/logger';
import { bookingSchema, validateRequestBody, sanitizeName, sanitizeText } from '@/lib/validation';

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
    // Rate limiting
    const clientId = getClientId(request);
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.booking);
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for booking', { clientId });
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate and sanitize input
    const validation = validateRequestBody(bookingSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const {
      clinicSlug,
      clinicId: requestClinicId,
      doctorId,
      name,
      phone,
      age,
      queueType = 'Consultation',
      consultationReason,
      chronicDiseases,
      source = 'patient',
      nurseId,
      nurseName,
    } = body;

    // Validate based on source
    if (source === 'patient') {
      // Patient bookings: require clinicSlug and doctorId
      if (!clinicSlug || typeof clinicSlug !== 'string') {
        return NextResponse.json(
          { ok: false, error: 'clinicSlug is required for patient bookings' },
          { status: 400 }
        );
      }

      if (!doctorId || typeof doctorId !== 'string') {
        return NextResponse.json(
          { ok: false, error: 'doctorId is required for patient bookings' },
          { status: 400 }
        );
      }
    }

    if (source === 'nurse') {
      // Nurse bookings: require clinicId and nurseId (doctorId is optional)
      if (!requestClinicId || typeof requestClinicId !== 'string') {
        return NextResponse.json(
          { ok: false, error: 'clinicId is required for nurse bookings' },
          { status: 400 }
        );
      }
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

    let clinicId: string;
    let clinicDoc: FirebaseFirestore.DocumentSnapshot;

    // Determine clinicId and fetch clinic document based on source
    if (source === 'nurse') {
      // Nurse booking: use clinicId directly from request
      clinicId = requestClinicId!;
      clinicDoc = await db.collection('clinics').doc(clinicId).get();

      if (!clinicDoc.exists) {
        return NextResponse.json(
          { ok: false, error: 'clinic not found' },
          { status: 404 }
        );
      }
    } else {
      // Patient booking: lookup clinic by slug
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

      clinicDoc = clinicQuery.docs[0];
      clinicId = clinicDoc.id;
    }

    const clinicData = clinicDoc.data()!;

    // SIMPLIFIED: Single doctor model - use clinic owner as the doctor
    // The doctor document ID is the same as ownerUid
    let finalDoctorId = clinicData.ownerUid;

    // For nurse bookings: verify nurse exists
    if (source === 'nurse') {
      if (!nurseId) {
        return NextResponse.json(
          { ok: false, error: 'nurseId is required for nurse bookings' },
          { status: 400 }
        );
      }

      const nurseRef = db.collection('nurses').doc(nurseId);
      const nurseSnap = await nurseRef.get();

      if (!nurseSnap.exists) {
        return NextResponse.json(
          { ok: false, error: 'nurse not found' },
          { status: 404 }
        );
      }

      const nurseData = nurseSnap.data()!;
      if (nurseData.clinicId !== clinicId) {
        return NextResponse.json(
          { ok: false, error: 'nurse does not belong to this clinic' },
          { status: 400 }
        );
      }
    }

    // Verify doctor exists, belongs to clinic, and is active
    const doctorRef = db.collection('doctors').doc(finalDoctorId);
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

    // Check for existing booking today using canonical bookingDay
    const todayBookingDay = getCairoBookingDay(new Date());
    const patientsRef = db.collection('patients');

    // Check for existing booking today BEFORE calculating queue number (to avoid skipping numbers)
    const existingQuery = await patientsRef
      .where('phone', '==', phone)
      .where('clinicId', '==', clinicId)
      .where('doctorId', '==', finalDoctorId)
      .where('bookingDay', '==', todayBookingDay)
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
            queueNumber: data.queueNumber,
            alreadyBooked: true,
          });
        }
      }
    }

    // Get next queue number for this doctor today using canonical bookingDay
    // FIXED: Now matches nurse's queue numbering logic exactly
    const queueQuery = await patientsRef
      .where('doctorId', '==', finalDoctorId)
      .where('clinicId', '==', clinicId)
      .where('bookingDay', '==', todayBookingDay)
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
        .where('doctorId', '==', finalDoctorId)
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
    const bookingDay = getCairoBookingDay(new Date()); // "YYYY-MM-DD" (Cairo)
    
    const patientData = {
      name: name.trim(),
      phone: phone.trim(),
      bookingDate: bookingDateTimestamp,
      bookingDay: bookingDay,            // Canonical day string
      age: age ? parseInt(age, 10) : null,
      chronicDiseases: chronicDiseases || null,
      consultationReason: consultationReason || null,
      queueType: finalQueueType,
      doctorId: finalDoctorId, // Use finalDoctorId instead of doctorId
      clinicId,
      source: source, // 'patient' or 'nurse'
      queueNumber,
      status: 'Waiting',
      createdAt: now,
      prescription: '',
      nurseId: nurseId || null,
      nurseName: nurseName || null,
    };

    const patientRef = await patientsRef.add(patientData);
    const patientId = patientRef.id;

    // Create booking ticket
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const ticketData = {
      clinicId,
      doctorId: finalDoctorId, // Use finalDoctorId
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

  } catch (error: unknown) {
    logger.error('Booking API error', error);
    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
