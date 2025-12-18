import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';
import { verifyPlatformAdmin } from '@/lib/platformAdminAuth';

/**
 * DELETE /api/platform/clients/[clientId]/delete
 * 
 * Permanently deletes a client and all associated data.
 * This is a destructive operation that cannot be undone.
 * 
 * Deletes:
 * - platformClients document
 * - clinic document
 * - All Firebase Auth users (owner + staff)
 * - All userProfiles
 * - All clinic data (doctors, nurses, patients, etc.)
 * 
 * Authorization: Platform Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Verify platform admin authorization
    const admin = await verifyPlatformAdmin(request);
    const adminUid = admin.uid;
    
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
    if (!clientData) {
      return NextResponse.json(
        { error: 'Invalid client data' },
        { status: 500 }
      );
    }
    
    const { clinicId, ownerUid } = clientData;
    
    // 1. Delete all Firebase Auth users associated with this clinic
    try {
      // Get all user profiles for this clinic
      const userProfilesSnapshot = await adminDb()
        .collection('userProfiles')
        .where('clinicId', '==', clinicId)
        .get();
      
      const userIds = userProfilesSnapshot.docs.map(doc => doc.id);
      
      // Delete all users from Firebase Auth
      for (const uid of userIds) {
        try {
          await authAdmin().deleteUser(uid);
          console.log(`Deleted user: ${uid}`);
        } catch (error) {
          console.error(`Failed to delete user ${uid}:`, error);
          // Continue with other deletions even if one fails
        }
      }
      
      // Also delete the owner if not already deleted
      if (!userIds.includes(ownerUid)) {
        try {
          await authAdmin().deleteUser(ownerUid);
          console.log(`Deleted owner: ${ownerUid}`);
        } catch (error) {
          console.error(`Failed to delete owner ${ownerUid}:`, error);
        }
      }
    } catch (error) {
      console.error('Error deleting users:', error);
      // Continue with other deletions
    }
    
    // 2. Delete all Firestore collections for this clinic
    const collectionsToDelete = [
      'userProfiles',
      'doctors',
      'nurses',
      'patients',
      'bookingTickets',
      'queueState',
      'invites',
    ];
    
    for (const collectionName of collectionsToDelete) {
      try {
        const snapshot = await adminDb()
          .collection(collectionName)
          .where('clinicId', '==', clinicId)
          .limit(500)
          .get();
        
        const batch = adminDb().batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Deleted ${snapshot.size} documents from ${collectionName}`);
      } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        // Continue with other deletions
      }
    }
    
    // 3. Delete clinic document
    try {
      await adminDb().collection('clinics').doc(clinicId).delete();
      console.log(`Deleted clinic: ${clinicId}`);
    } catch (error) {
      console.error('Error deleting clinic:', error);
    }
    
    // 4. Delete platformClients document
    await adminDb().collection('platformClients').doc(clientId).delete();
    console.log(`Deleted platformClient: ${clientId}`);
    
    return NextResponse.json({
      ok: true,
      message: 'Client deleted permanently',
      deletedBy: adminUid,
    });
    
  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Failed to delete client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
