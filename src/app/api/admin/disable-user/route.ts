/**
 * Admin API: Disable User
 * 
 * POST /api/admin/disable-user
 * 
 * Disables a user's Firebase Auth account (requires owner permissions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token
    const decodedToken = await authAdmin().verifyIdToken(token);
    const requestorUid = decodedToken.uid;

    // Get request body
    const { userId, clinicId } = await request.json();

    if (!userId || !clinicId) {
      return NextResponse.json(
        { error: 'Missing userId or clinicId' },
        { status: 400 }
      );
    }

    // Verify requestor is owner of the clinic
    const requestorProfileRef = adminDb().collection('userProfiles').doc(requestorUid);
    const requestorProfileSnap = await requestorProfileRef.get();

    if (!requestorProfileSnap.exists) {
      return NextResponse.json(
        { error: 'Requestor profile not found' },
        { status: 404 }
      );
    }

    const requestorProfile = requestorProfileSnap.data();
    if (requestorProfile?.role !== 'owner' || requestorProfile?.clinicId !== clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized: Only clinic owner can disable users' },
        { status: 403 }
      );
    }

    // Verify target user belongs to same clinic
    const targetUserProfileRef = adminDb().collection('userProfiles').doc(userId);
    const targetUserProfileSnap = await targetUserProfileRef.get();

    if (!targetUserProfileSnap.exists) {
      return NextResponse.json(
        { error: 'Target user profile not found' },
        { status: 404 }
      );
    }

    const targetUserProfile = targetUserProfileSnap.data();
    if (targetUserProfile?.clinicId !== clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized: User does not belong to your clinic' },
        { status: 403 }
      );
    }

    // Cannot disable owner
    if (targetUserProfile?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot disable clinic owner' },
        { status: 400 }
      );
    }

    // Disable user in Firebase Auth
    await authAdmin().updateUser(userId, {
      disabled: true,
    });

    // Revoke all refresh tokens (force logout)
    await authAdmin().revokeRefreshTokens(userId);

    return NextResponse.json({
      ok: true,
      message: 'User disabled successfully',
      userId: userId,
    });

  } catch (error: unknown) {
    console.error('Error disabling user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to disable user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
