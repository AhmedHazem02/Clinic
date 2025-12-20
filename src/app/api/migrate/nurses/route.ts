/**
 * Migration API: Add doctorId to nurses without one
 *
 * Usage: POST /api/migrate/nurses
 *
 * This is a one-time migration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const db = adminDb();

    console.log('🔍 Fetching all nurses...');
    const nursesSnapshot = await db.collection('nurses').get();
    console.log(`📊 Found ${nursesSnapshot.size} nurses`);

    let updated = 0;
    let alreadyHaveDoctorId = 0;
    let errors = 0;
    const results: any[] = [];

    for (const nurseDoc of nursesSnapshot.docs) {
      const nurseData = nurseDoc.data();
      const nurseId = nurseDoc.id;

      // Check if nurse already has doctorId
      if (nurseData.doctorId) {
        console.log(`✅ ${nurseData.name} (${nurseId}) already has doctorId: ${nurseData.doctorId}`);
        alreadyHaveDoctorId++;
        results.push({
          nurseId,
          nurseName: nurseData.name,
          status: 'already_has_doctorId',
          doctorId: nurseData.doctorId
        });
        continue;
      }

      console.log(`⚠️  ${nurseData.name} (${nurseId}) is missing doctorId`);

      // Get first active doctor from the same clinic
      if (!nurseData.clinicId) {
        console.log(`   ❌ Nurse has no clinicId, skipping...`);
        errors++;
        results.push({
          nurseId,
          nurseName: nurseData.name,
          status: 'error',
          error: 'no_clinicId'
        });
        continue;
      }

      const doctorsQuery = await db.collection('doctors')
        .where('clinicId', '==', nurseData.clinicId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (doctorsQuery.empty) {
        console.log(`   ❌ No active doctors found in clinic ${nurseData.clinicId}`);
        errors++;
        results.push({
          nurseId,
          nurseName: nurseData.name,
          status: 'error',
          error: 'no_active_doctors'
        });
        continue;
      }

      const doctorId = doctorsQuery.docs[0].id;
      const doctorName = doctorsQuery.docs[0].data().name;

      // Update nurse with doctorId
      await nurseDoc.ref.update({ doctorId });
      console.log(`   ✅ Updated ${nurseData.name} -> assigned to Dr. ${doctorName} (${doctorId})`);
      updated++;
      results.push({
        nurseId,
        nurseName: nurseData.name,
        status: 'updated',
        doctorId,
        doctorName
      });
    }

    const summary = {
      total: nursesSnapshot.size,
      alreadyHaveDoctorId,
      updated,
      errors,
      results
    };

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Already had doctorId: ${alreadyHaveDoctorId}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${nursesSnapshot.size}`);

    return NextResponse.json({
      ok: true,
      message: 'Migration completed successfully',
      summary
    });

  } catch (error: any) {
    console.error('💥 Migration failed:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Migration failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
