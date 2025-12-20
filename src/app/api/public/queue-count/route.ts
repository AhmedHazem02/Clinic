import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { getTodayRange } from '@/lib/dateRange';
import { getCairoBookingDay } from '@/lib/bookingDay';

/**
 * GET /api/public/queue-count
 * 
 * Returns the count of active patients (Waiting + Consulting) for today
 * for a specific doctor in a clinic.
 * Uses bookingDay field (canonical "YYYY-MM-DD" string in Cairo timezone).
 * 
 * Query params:
 * - clinicSlug: Clinic URL slug
 * - doctorId: Doctor ID
 * 
 * Returns:
 * - { ok: true, peopleAhead: number }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clinicSlug = searchParams.get('clinicSlug');
    const doctorId = searchParams.get('doctorId');

    // Validate input
    if (!clinicSlug || !doctorId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const db = adminDb();

    // 1. Resolve clinicId by slug (active clinics only)
    const clinicsSnapshot = await db
      .collection('clinics')
      .where('slug', '==', clinicSlug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (clinicsSnapshot.empty) {
      return NextResponse.json(
        { ok: false, error: 'Clinic not found' },
        { status: 404 }
      );
    }

    const clinicDoc = clinicsSnapshot.docs[0];
    const clinicId = clinicDoc.id;

    // 2. Validate doctor exists, belongs to clinic, and is active
    const doctorDoc = await db.collection('doctors').doc(doctorId).get();

    if (!doctorDoc.exists) {
      return NextResponse.json(
        { ok: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    const doctorData = doctorDoc.data();
    if (doctorData?.clinicId !== clinicId) {
      return NextResponse.json(
        { ok: false, error: 'Doctor does not belong to this clinic' },
        { status: 403 }
      );
    }

    if (doctorData?.isActive !== true) {
      return NextResponse.json(
        { ok: false, error: 'Doctor is not active' },
        { status: 403 }
      );
    }

    // 3. Get today's bookingDay (Cairo timezone)
    const today = getCairoBookingDay(); // "YYYY-MM-DD"

    // 4. Count active patients for today using bookingDay
    const patientsQuery = db
      .collection('patients')
      .where('clinicId', '==', clinicId)
      .where('doctorId', '==', doctorId)
      .where('bookingDay', '==', today)
      .where('status', 'in', ['Waiting', 'Consulting']);

    // Use aggregation count if available, else fallback to get()
    try {
      const countSnapshot = await patientsQuery.count().get();
      let peopleAhead = countSnapshot.data().count;

      // Fallback for old documents without bookingDay (backward compatibility)
      if (peopleAhead === 0) {
        const { start, end } = getTodayRange();
        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);

        const fallbackQuery = db
          .collection('patients')
          .where('clinicId', '==', clinicId)
          .where('doctorId', '==', doctorId)
          .where('bookingDate', '>=', startTimestamp)
          .where('bookingDate', '<=', endTimestamp)
          .where('status', 'in', ['Waiting', 'Consulting']);

        const fallbackSnapshot = await fallbackQuery.get();
        // Only count legacy docs that don't have bookingDay
        peopleAhead = fallbackSnapshot.docs.filter(doc => !doc.data().bookingDay).length;
      }

      return NextResponse.json({
        ok: true,
        peopleAhead,
      });
    } catch (countError) {
      // Fallback: get documents and count manually
      console.warn('Count aggregation not available, using manual count:', countError);
      const snapshot = await patientsQuery.get();
      let peopleAhead = snapshot.size;

      // Fallback for old documents
      if (peopleAhead === 0) {
        const { start, end } = getTodayRange();
        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);

        const fallbackQuery = db
          .collection('patients')
          .where('clinicId', '==', clinicId)
          .where('doctorId', '==', doctorId)
          .where('bookingDate', '>=', startTimestamp)
          .where('bookingDate', '<=', endTimestamp)
          .where('status', 'in', ['Waiting', 'Consulting']);

        const fallbackSnapshot = await fallbackQuery.get();
        peopleAhead = fallbackSnapshot.docs.filter(doc => !doc.data().bookingDay).length;
      }

      return NextResponse.json({
        ok: true,
        peopleAhead,
      });
    }
  } catch (error) {
    console.error('Error in queue-count API:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
