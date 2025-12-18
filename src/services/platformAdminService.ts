/**
 * Platform Admin Service
 * 
 * Handles authorization checks for platform super admins.
 * Platform admins can manage clinic customers (create, suspend, cancel).
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { PlatformAdmin } from '@/types/multitenant';

/**
 * Check if a user is an active platform admin
 * 
 * @param uid - Firebase Auth UID
 * @returns true if user is an active platform admin, false otherwise
 */
export async function isPlatformAdmin(uid: string): Promise<boolean> {
  try {
    const { db } = getFirebase();
    const adminRef = doc(db, 'platformAdmins', uid);
    const adminSnap = await getDoc(adminRef);
    
    if (!adminSnap.exists()) {
      return false;
    }
    
    const adminData = adminSnap.data() as PlatformAdmin;
    return adminData.isActive === true;
  } catch (error) {
    console.error('Error checking platform admin status:', error);
    return false;
  }
}

/**
 * Get platform admin data
 * 
 * @param uid - Firebase Auth UID
 * @returns Platform admin data or null if not found/inactive
 */
export async function getPlatformAdmin(uid: string): Promise<PlatformAdmin | null> {
  try {
    const { db } = getFirebase();
    const adminRef = doc(db, 'platformAdmins', uid);
    const adminSnap = await getDoc(adminRef);
    
    if (!adminSnap.exists()) {
      return null;
    }
    
    const adminData = { uid, ...adminSnap.data() } as PlatformAdmin;
    
    if (!adminData.isActive) {
      return null;
    }
    
    return adminData;
  } catch (error) {
    console.error('Error getting platform admin:', error);
    return null;
  }
}
