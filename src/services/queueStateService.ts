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
import { logger } from "@/lib/logger";

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
 * @param additionalData - Optional additional data to merge (stats updates)
 */
export async function updateQueueState(
  clinicId: string,
  doctorId: string,
  currentConsultingQueueNumber: number | null,
  additionalData?: Partial<QueueState>
): Promise<void> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  const updateData: Record<string, unknown> = {
    clinicId,
    doctorId,
    currentConsultingQueueNumber,
    isOpen: true,
    updatedAt: Timestamp.now(),
  };

  // Merge additional data if provided
  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  await setDoc(queueStateRef, updateData, { merge: true });
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
      logger.error('Error listening to queue state', error);
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

/**
 * Update the maximum queue number for today
 * Called when a new patient is added to track the highest queue number
 *
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @param queueNumber - New queue number to compare with current max
 */
export async function updateMaxQueueNumber(
  clinicId: string,
  doctorId: string,
  queueNumber: number
): Promise<void> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  // Get current state
  const snap = await getDoc(queueStateRef);
  const currentMax = snap.exists() ? snap.data().currentMaxQueueNumberToday ?? 0 : 0;

  // Only update if new queue number is higher
  if (queueNumber > currentMax) {
    await setDoc(queueStateRef, {
      clinicId,
      doctorId,
      currentMaxQueueNumberToday: queueNumber,
      isOpen: true,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }
}

/**
 * Update queue statistics (waiting count, finished count, etc.)
 * Called periodically or on each status change
 *
 * @param clinicId - Clinic ID
 * @param doctorId - Doctor ID
 * @param stats - Queue statistics to update
 */
export async function updateQueueStats(
  clinicId: string,
  doctorId: string,
  stats: {
    totalWaitingCount?: number;
    totalFinishedCount?: number;
    averageWaitTimeMinutes?: number;
    queueStartedAt?: Date;
    lastPatientFinishedAt?: Date;
  }
): Promise<void> {
  const { db } = getFirebase();
  const queueStateId = getQueueStateId(clinicId, doctorId);
  const queueStateRef = doc(db, 'queueState', queueStateId);

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (stats.totalWaitingCount !== undefined) {
    updateData.totalWaitingCount = stats.totalWaitingCount;
  }
  if (stats.totalFinishedCount !== undefined) {
    updateData.totalFinishedCount = stats.totalFinishedCount;
  }
  if (stats.averageWaitTimeMinutes !== undefined) {
    updateData.averageWaitTimeMinutes = stats.averageWaitTimeMinutes;
  }
  if (stats.queueStartedAt) {
    updateData.queueStartedAt = Timestamp.fromDate(stats.queueStartedAt);
  }
  if (stats.lastPatientFinishedAt) {
    updateData.lastPatientFinishedAt = Timestamp.fromDate(stats.lastPatientFinishedAt);
  }

  await setDoc(queueStateRef, updateData, { merge: true });
}
