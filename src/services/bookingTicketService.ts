/**
 * Booking Ticket Service
 * 
 * Manages privacy-safe public booking tickets for patient status access.
 * Tickets contain minimal non-sensitive information suitable for public display.
 */

import { getFirebase } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { BookingTicket } from "@/types/multitenant";

/**
 * Create a new booking ticket for public status access
 * 
 * @param ticketData - Booking ticket data
 * @returns Promise resolving to the created ticket ID
 */
export async function createBookingTicket(
  ticketData: Omit<BookingTicket, 'id' | 'createdAt' | 'expiresAt'>
): Promise<string> {
  const { db } = getFirebase();
  const ticketsCollection = collection(db, 'bookingTickets');

  // Set expiry to end of day (or custom logic)
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const ticketDoc = {
    ...ticketData,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(endOfDay),
  };

  const docRef = await addDoc(ticketsCollection, ticketDoc);
  return docRef.id;
}

/**
 * Get a booking ticket by ID
 * 
 * @param ticketId - Ticket document ID
 * @returns Promise resolving to the booking ticket or null if not found/expired
 */
export async function getBookingTicket(ticketId: string): Promise<BookingTicket | null> {
  const { db } = getFirebase();
  const ticketRef = doc(db, 'bookingTickets', ticketId);

  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) {
    return null;
  }

  const ticket = { id: ticketSnap.id, ...ticketSnap.data() } as BookingTicket;

  // Check if ticket has expired
  const now = new Date();
  const expiresAt = ticket.expiresAt instanceof Timestamp
    ? ticket.expiresAt.toDate()
    : new Date(ticket.expiresAt);

  if (now > expiresAt) {
    // Ticket expired, optionally delete or mark as expired
    return null;
  }

  return ticket;
}

/**
 * Update booking ticket status
 * 
 * @param ticketId - Ticket document ID
 * @param status - New status
 */
export async function updateBookingTicketStatus(
  ticketId: string,
  status: 'Waiting' | 'Consulting' | 'Finished'
): Promise<void> {
  const { db } = getFirebase();
  const ticketRef = doc(db, 'bookingTickets', ticketId);

  await updateDoc(ticketRef, {
    status,
  });
}

/**
 * Get booking ticket by patient ID
 * Useful for finding the ticket when we have the patient document
 * 
 * @param patientId - Patient document ID
 * @returns Promise resolving to the booking ticket or null
 */
export async function getBookingTicketByPatientId(patientId: string): Promise<BookingTicket | null> {
  const { db } = getFirebase();
  const ticketsCollection = collection(db, 'bookingTickets');

  const q = query(
    ticketsCollection,
    where('patientId', '==', patientId),
    where('status', '!=', 'Finished')
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const ticketDoc = snapshot.docs[0];
  return { id: ticketDoc.id, ...ticketDoc.data() } as BookingTicket;
}

/**
 * Delete old/expired booking tickets (cleanup utility)
 * 
 * @param beforeDate - Delete tickets created before this date
 */
export async function deleteExpiredTickets(beforeDate: Date): Promise<number> {
  const { db } = getFirebase();
  const ticketsCollection = collection(db, 'bookingTickets');

  const q = query(
    ticketsCollection,
    where('expiresAt', '<', Timestamp.fromDate(beforeDate))
  );

  const snapshot = await getDocs(q);
  
  let deleteCount = 0;
  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
    deleteCount++;
  }

  return deleteCount;
}

/**
 * Sanitize patient name for public display
 * Example: "أحمد محمد" -> "أ.م"
 * 
 * @param fullName - Full patient name
 * @returns Sanitized name with first letters only
 */
export function sanitizeDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0) + '.';
  
  return parts.map(part => part.charAt(0)).join('.') + '.';
}

/**
 * Get last 4 digits of phone number
 * 
 * @param phone - Full phone number
 * @returns Last 4 digits or empty string
 */
export function getPhoneLast4(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return digits;
  return digits.slice(-4);
}
