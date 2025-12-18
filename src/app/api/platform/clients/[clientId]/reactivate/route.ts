/**
 * Platform Admin API: Reactivate Client
 * 
 * POST /api/platform/clients/[clientId]/reactivate
 * 
 * Reactivates a suspended clinic client:
 * - Sets platform client status to 'active'
 * - Activates clinic (isActive = true)
 * - Re-enables all auth users associated with the clinic
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

    // Cannot reactivate a canceled client
    if (clientData?.status === 'canceled') {
      return NextResponse.json(
        { error: 'Cannot reactivate a canceled client' },
        { status: 400 }
      );
    }

    // Step 1: Update platform client status
    await adminDb().collection('platformClients').doc(clientId).update({
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
      lastModifiedBy: adminUid,
    });

    // Step 2: Activate clinic
    await adminDb().collection('clinics').doc(clinicId).update({
      isActive: true,
      subscriptionStatus: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Step 3: Re-enable all auth users associated with this clinic
    const userProfilesSnapshot = await adminDb()
      .collection('userProfiles')
      .where('clinicId', '==', clinicId)
      .get();

    const enablePromises = userProfilesSnapshot.docs.map(async (doc) => {
      const uid = doc.id;
      try {
        await authAdmin().updateUser(uid, { disabled: false });
        // Update user profile
        await adminDb().collection('userProfiles').doc(uid).update({
          isActive: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error(`Failed to enable user ${uid}:`, error);
      }
    });

    await Promise.all(enablePromises);

    return NextResponse.json({
      ok: true,
      message: 'Client reactivated successfully',
      clientId: clientId,
      clinicId: clinicId,
      usersEnabled: userProfilesSnapshot.size,
    });

  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error reactivating client:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
