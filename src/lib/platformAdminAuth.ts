/**
 * Platform Admin Authorization Helper
 * 
 * Server-side helper for verifying platform admin access in API routes.
 * Must be used in every /api/platform/* route handler.
 */

import { NextRequest } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';

export interface PlatformAdminAuth {
  uid: string;
  email: string;
}

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Verify that the request is from an active platform admin
 * 
 * @param request - Next.js request object
 * @returns Platform admin info if verified
 * @throws AuthError with status and message if verification fails
 */
export async function verifyPlatformAdmin(request: NextRequest): Promise<PlatformAdminAuth> {
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw {
        status: 401,
        message: 'Unauthorized - Missing or invalid authorization header'
      } as AuthError;
    }

    // Extract ID token
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      throw {
        status: 401,
        message: 'Unauthorized - No token provided'
      } as AuthError;
    }

    // Verify Firebase ID token
    const decodedToken = await authAdmin().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    // Check if user is a platform admin
    const adminDoc = await adminDb().collection('platformAdmins').doc(uid).get();
    
    if (!adminDoc.exists) {
      throw {
        status: 403,
        message: 'Forbidden - User is not a platform admin'
      } as AuthError;
    }

    const adminData = adminDoc.data();
    if (!adminData || adminData.isActive !== true) {
      throw {
        status: 403,
        message: 'Forbidden - Platform admin account is inactive'
      } as AuthError;
    }

    return {
      uid,
      email: email || adminData.email || ''
    };

  } catch (error: unknown) {
    // If it's already an AuthError, re-throw it
    if (error && typeof error === 'object' && 'status' in error) {
      throw error;
    }

    // Handle Firebase auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };
      
      if (firebaseError.code === 'auth/id-token-expired') {
        throw {
          status: 401,
          message: 'Unauthorized - Token expired'
        } as AuthError;
      }
      
      if (firebaseError.code === 'auth/argument-error') {
        throw {
          status: 401,
          message: 'Unauthorized - Invalid token format'
        } as AuthError;
      }
    }

    // Generic error
    console.error('Platform admin verification error:', error);
    throw {
      status: 401,
      message: 'Unauthorized - Failed to verify credentials'
    } as AuthError;
  }
}
