/**
 * Invite Service
 *
 * Manages staff invitations in the multi-tenant system.
 * Uses secure token-based invitations with SHA-256 hashing.
 */

import { getFirebase } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import type { UserRole } from "@/types/multitenant";
import { logger } from "@/lib/logger";

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invite {
  id?: string;
  clinicId: string;
  email: string;
  role: 'doctor' | 'nurse';
  createdByUid: string;
  tokenHash: string;
  status: InviteStatus;
  expiresAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  acceptedByUid?: string;
  acceptedAt?: Timestamp | Date;
}

/**
 * Generate a secure random string for tokens
 */
function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Base64 URL-safe encoding
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL-safe decoding
 */
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * SHA-256 hash a string
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an invite token
 * Format: base64url({clinicId}:{inviteId}:{randomSecret})
 *
 * @param clinicId - The clinic ID
 * @param inviteId - The invite document ID
 * @returns The generated token
 */
export function generateInviteToken(clinicId: string, inviteId: string): string {
  const secret = generateRandomString(32);
  const payload = `${clinicId}:${inviteId}:${secret}`;
  return base64UrlEncode(payload);
}

/**
 * Parse an invite token
 *
 * @param token - The invite token
 * @returns Parsed token components or null if invalid
 */
export function parseInviteToken(token: string): {
  clinicId: string;
  inviteId: string;
  secret: string;
} | null {
  try {
    const decoded = base64UrlDecode(token);
    const parts = decoded.split(':');
    if (parts.length !== 3) {
      return null;
    }
    return {
      clinicId: parts[0],
      inviteId: parts[1],
      secret: parts[2],
    };
  } catch (error) {
    logger.error('Error parsing invite token', error);
    return null;
  }
}

/**
 * Create a new staff invitation
 *
 * @param clinicId - The clinic ID
 * @param inviteData - Invitation data
 * @param creatorUid - UID of the user creating the invite
 * @returns The created invite with token
 */
export async function createInvite(
  clinicId: string,
  inviteData: {
    email: string;
    role: 'doctor' | 'nurse';
    expiryDays?: number;
  },
  creatorUid: string
): Promise<{ invite: Invite; token: string }> {
  const { db } = getFirebase();

  // Check if there's already a pending invite for this email in this clinic
  const invitesRef = collection(db, 'clinics', clinicId, 'invites');
  const existingQuery = query(
    invitesRef,
    where('email', '==', inviteData.email.toLowerCase()),
    where('status', '==', 'pending')
  );
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    throw new Error('An active invitation already exists for this email');
  }

  // Calculate expiry
  const expiryDays = inviteData.expiryDays || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  // Create invite document (without token yet)
  const inviteDoc: Omit<Invite, 'id' | 'tokenHash'> = {
    clinicId,
    email: inviteData.email.toLowerCase(),
    role: inviteData.role,
    createdByUid: creatorUid,
    status: 'pending',
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(invitesRef, inviteDoc);

  // Generate token with the invite ID
  const token = generateInviteToken(clinicId, docRef.id);

  // Reconstruct full token payload and hash it
  const tokenPayload = base64UrlDecode(token);
  const tokenHash = await sha256(tokenPayload);

  // Update invite with token hash
  await updateDoc(docRef, { tokenHash });

  return {
    invite: {
      ...inviteDoc,
      id: docRef.id,
      tokenHash,
    },
    token,
  };
}

/**
 * Verify an invite token and get the invite
 *
 * @param token - The invite token
 * @returns The invite if valid, null otherwise
 */
export async function verifyInviteToken(token: string): Promise<Invite | null> {
  const { db } = getFirebase();

  // Parse token
  const parsed = parseInviteToken(token);
  if (!parsed) {
    return null;
  }

  const { clinicId, inviteId } = parsed;

  // Get invite document
  const inviteRef = doc(db, 'clinics', clinicId, 'invites', inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    return null;
  }

  const invite = {
    id: inviteSnap.id,
    ...inviteSnap.data(),
  } as Invite;

  // Verify token hash
  const tokenPayload = base64UrlDecode(token);
  const tokenHash = await sha256(tokenPayload);

  if (tokenHash !== invite.tokenHash) {
    logger.warn('Token hash mismatch during invite verification');
    return null;
  }

  // Check if invite is expired
  const now = new Date();
  const expiresAt = invite.expiresAt instanceof Timestamp
    ? invite.expiresAt.toDate()
    : new Date(invite.expiresAt);

  if (now > expiresAt && invite.status === 'pending') {
    // Mark as expired
    await updateDoc(inviteRef, { status: 'expired' });
    return null;
  }

  // Check if invite is not pending
  if (invite.status !== 'pending') {
    return null;
  }

  return invite;
}

/**
 * Accept an invitation
 *
 * @param inviteId - The invite ID
 * @param clinicId - The clinic ID
 * @param accepterUid - UID of the user accepting the invite
 */
export async function acceptInvite(
  inviteId: string,
  clinicId: string,
  accepterUid: string
): Promise<void> {
  const { db } = getFirebase();
  const inviteRef = doc(db, 'clinics', clinicId, 'invites', inviteId);

  await updateDoc(inviteRef, {
    status: 'accepted',
    acceptedByUid: accepterUid,
    acceptedAt: Timestamp.now(),
  });
}

/**
 * Revoke an invitation
 *
 * @param inviteId - The invite ID
 * @param clinicId - The clinic ID
 */
export async function revokeInvite(inviteId: string, clinicId: string): Promise<void> {
  const { db } = getFirebase();
  const inviteRef = doc(db, 'clinics', clinicId, 'invites', inviteId);

  await updateDoc(inviteRef, {
    status: 'revoked',
  });
}

/**
 * Get all invitations for a clinic
 *
 * @param clinicId - The clinic ID
 * @returns Array of invites
 */
export async function getClinicInvites(clinicId: string): Promise<Invite[]> {
  const { db } = getFirebase();
  const invitesRef = collection(db, 'clinics', clinicId, 'invites');
  const snapshot = await getDocs(invitesRef);

  const invites: Invite[] = [];
  snapshot.forEach((doc) => {
    invites.push({
      id: doc.id,
      ...doc.data(),
    } as Invite);
  });

  return invites;
}
