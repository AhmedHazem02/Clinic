/**
 * Platform Admin API: Generate Password Reset Link
 * 
 * POST /api/platform/clients/[clientId]/reset-link
 * 
 * Generates a new password reset link for the clinic owner.
 * 
 * Authorization: Platform Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';
import { verifyPlatformAdmin } from '@/lib/platformAdminAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Verify platform admin authorization
    await verifyPlatformAdmin(request);

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
    const ownerEmail = clientData?.ownerEmail;

    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Owner email not found' },
        { status: 400 }
      );
    }

    // Generate password reset link
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/login`,
      handleCodeInApp: false,
    };

    const resetLink = await authAdmin().generatePasswordResetLink(ownerEmail, actionCodeSettings);

    return NextResponse.json({
      ok: true,
      resetLink: resetLink,
      ownerEmail: ownerEmail,
    });

  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error generating reset link:', error);
    return NextResponse.json(
      { error: 'Failed to generate reset link', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
