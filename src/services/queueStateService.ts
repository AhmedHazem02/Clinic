/**
 * Queue State Service
 * 
 * Manages public-safe queue state for real-time status updates without exposing patient lists.
 * This prevents scraping and enforces get-only access for public users.
 */

import { getFirebase } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { QueueState } from "@/types/multitenant";

/**
 * Generate queue state document ID
 */
export function getQueueStateId(clinicId: string, doctorId: string): string {
  return `${clinicId}_${doctorId}`;
}

/**
 * Update queue state when a patient status changes
 * 
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @param currentConsultingQueueNumber - Queue number currently consulting (null if none)
 */
export async function updateQueueState(
  clinicId: string,
  doctorId: string,
  currentConsultingQueueNumber: number | null
): Promise<void> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  await setDoc(queueStateRef, {
    clinicId,
    doctorId,
    currentConsultingQueueNumber,
    isOpen: true,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

/**
 * Get current queue state
 * 
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @returns Promise resolving to queue state or null
 */
export async function getQueueState(
  clinicId: string,
  doctorId: string
): Promise<QueueState | null> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  const snap = await getDoc(queueStateRef);
  if (!snap.exists()) {
    return null;
  }

  return { id: snap.id, ...snap.data() } as QueueState;
}

/**
 * Listen to queue state changes
 * 
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @param callback - Callback function for state updates
 * @returns Unsubscribe function
 */
export function listenToQueueState(
  clinicId: string,
  doctorId: string,
  callback: (state: QueueState | null) => void
): Unsubscribe {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  return onSnapshot(
    queueStateRef,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as QueueState);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Error listening to queue state:', error);
      callback(null);
    }
  );
}

/**
 * Initialize queue state for a doctor (typically called when doctor starts their day)
 * 
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 */
export async function initializeQueueState(
  clinicId: string,
  doctorId: string
): Promise<void> {
  await updateQueueState(clinicId, doctorId, null);
}

/**
 * Close queue (mark as not accepting new patients)
 * 
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 */
export async function closeQueue(
  clinicId: string,
  doctorId: string
): Promise<void> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  await setDoc(queueStateRef, {
    isOpen: false,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}
