import { NextRequest, NextResponse } from 'next/server';
import { verifyPlatformAdmin } from '@/lib/platformAdminAuth';

/**
 * GET /api/platform/me
 * 
 * Verifies if the authenticated user is a platform admin.
 * Returns platform admin status and user info.
 * 
 * Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * - 200: { ok: true, isPlatformAdmin: true, uid: string, email: string }
 * - 401/403: { ok: false, isPlatformAdmin: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify platform admin using centralized helper
    const admin = await verifyPlatformAdmin(request);
    
    return NextResponse.json({
      ok: true,
      isPlatformAdmin: true,
      uid: admin.uid,
      email: admin.email,
    });
  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { 
          ok: false, 
          isPlatformAdmin: false, 
          error: (error as { message: string }).message 
        },
        { status: (error as { status: number }).status }
      );
    }

    // Handle unexpected errors
    console.error('Error verifying platform admin:', error);
    return NextResponse.json(
      { 
        ok: false, 
        isPlatformAdmin: false, 
        error: 'Failed to verify admin status' 
      },
      { status: 500 }
    );
  }
}
