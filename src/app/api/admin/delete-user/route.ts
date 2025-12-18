import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';

/**
 * DELETE /api/admin/delete-user
 * Permanently deletes a user account (Firebase Auth + Firestore documents)
 * 
 * Authorization: Only clinic owner can delete users from their clinic
 * 
 * Request Body:
 * - userId: UID of user to delete
 * - clinicId: Clinic ID to verify authorization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, clinicId } = body;

    // Validate input
    if (!userId || !clinicId) {
      return NextResponse.json(
        { error: 'Missing userId or clinicId' },
        { status: 400 }
      );
    }

    // Get requestor's UID from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    let requestorUid: string;
    
    try {
      const decodedToken = await authAdmin().verifyIdToken(idToken);
      requestorUid = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify requestor is the owner of the clinic
    const requestorProfileDoc = await adminDb()
      .collection('userProfiles')
      .doc(requestorUid)
      .get();

    if (!requestorProfileDoc.exists) {
      return NextResponse.json(
        { error: 'Requestor profile not found' },
        { status: 404 }
      );
    }

    const requestorProfile = requestorProfileDoc.data();

    // Check if requestor is owner AND belongs to the same clinic
    if (requestorProfile?.role !== 'owner' || requestorProfile?.clinicId !== clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized: Only clinic owner can delete users' },
        { status: 403 }
      );
    }

    // Prevent owner from deleting themselves
    if (userId === requestorUid) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Verify user belongs to the same clinic
    const userProfileDoc = await adminDb()
      .collection('userProfiles')
      .doc(userId)
      .get();

    if (!userProfileDoc.exists) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const userProfile = userProfileDoc.data();
    if (userProfile?.clinicId !== clinicId) {
      return NextResponse.json(
        { error: 'User does not belong to your clinic' },
        { status: 403 }
      );
    }

    // ============================================
    // PERMANENT DELETION
    // ============================================

    // 1. Delete from Firebase Authentication
    try {
      await authAdmin().deleteUser(userId);
      console.log(`Deleted Firebase Auth user: ${userId}`);
    } catch (error: any) {
      // User might already be deleted or not exist
      console.warn(`Could not delete Firebase Auth user ${userId}:`, error.message);
    }

    // 2. Delete userProfile document
    try {
      await adminDb().collection('userProfiles').doc(userId).delete();
      console.log(`Deleted userProfile: ${userId}`);
    } catch (error: any) {
      console.warn(`Could not delete userProfile ${userId}:`, error.message);
    }

    // 3. Delete doctor/nurse document (based on role)
    const role = userProfile?.role;
    if (role === 'doctor') {
      try {
        await adminDb().collection('doctors').doc(userId).delete();
        console.log(`Deleted doctor document: ${userId}`);
      } catch (error: any) {
        console.warn(`Could not delete doctor ${userId}:`, error.message);
      }
    } else if (role === 'nurse') {
      try {
        await adminDb().collection('nurses').doc(userId).delete();
        console.log(`Deleted nurse document: ${userId}`);
      } catch (error: any) {
        console.warn(`Could not delete nurse ${userId}:`, error.message);
      }
    }

    // 4. Optional: Delete related data (patients registered by this nurse, etc.)
    // For now, we keep patients but they lose their nurseId reference
    // You can add more cleanup here if needed

    return NextResponse.json({
      success: true,
      message: `User ${userId} permanently deleted`,
      deletedFrom: ['auth', 'userProfiles', role === 'doctor' ? 'doctors' : 'nurses'],
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
