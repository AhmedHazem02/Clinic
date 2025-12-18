/**
 * Platform Admin API: Suspend Client
 * 
 * POST /api/platform/clients/[clientId]/suspend
 * 
 * Suspends a clinic client:
 * - Sets platform client status to 'suspended'
 * - Deactivates clinic (isActive = false)
 * - Disables all auth users associated with the clinic
 * 
 * Authorization: Platform Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyPlatformAdmin } from '@/lib/platformAdminAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Verify platform admin authorization
    const admin = await verifyPlatformAdmin(request);
    const adminUid = admin.uid;

    // Get client ID from params
    const { clientId } = await params;

    // Get client document
    const clientDoc = await adminDb().collection('platformClients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data();
    const clinicId = clientData?.clinicId;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'Clinic ID not found' },
        { status: 400 }
      );
    }

    // Step 1: Update platform client status
    await adminDb().collection('platformClients').doc(clientId).update({
      status: 'suspended',
      updatedAt: FieldValue.serverTimestamp(),
      lastModifiedBy: adminUid,
    });

    // Step 2: Deactivate clinic
    await adminDb().collection('clinics').doc(clinicId).update({
      isActive: false,
      subscriptionStatus: 'suspended',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Step 3: Disable all auth users associated with this clinic
    const userProfilesSnapshot = await adminDb()
      .collection('userProfiles')
      .where('clinicId', '==', clinicId)
      .get();

    const disablePromises = userProfilesSnapshot.docs.map(async (doc) => {
      const uid = doc.id;
      try {
        await authAdmin().updateUser(uid, { disabled: true });
        // Update user profile
        await adminDb().collection('userProfiles').doc(uid).update({
          isActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error(`Failed to disable user ${uid}:`, error);
      }
    });

    await Promise.all(disablePromises);

    return NextResponse.json({
      ok: true,
      message: 'Client suspended successfully',
      clientId: clientId,
      clinicId: clinicId,
      usersDisabled: userProfilesSnapshot.size,
    });

  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error suspending client:', error);
    return NextResponse.json(
      { error: 'Failed to suspend client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
