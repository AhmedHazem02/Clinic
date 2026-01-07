import { getFirebase } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    onSnapshot,
    orderBy,
    limit,
    doc,
    updateDoc,
    writeBatch,
    deleteDoc,
    or,
    and,
    setDoc,
    getDoc,
    increment,
    addDoc,
    serverTimestamp
} from "firebase/firestore";
import { getCairoBookingDay } from "@/lib/bookingDay";
import { logger } from "@/lib/logger";

export type PatientStatus = 'Waiting' | 'Consulting' | 'Finished';
export type QueueType = 'Consultation' | 'Re-consultation';

/**
 * Calculate queue statistics for a specific doctor/clinic/day
 * Used to provide accurate wait time estimates for patients
 */
export const calculateQueueStats = async (
    doctorId: string,
    clinicId: string,
    bookingDay: string
): Promise<{
    totalWaitingCount: number;
    totalFinishedCount: number;
    averageWaitTimeMinutes: number;
    queueStartedAt?: Date;
    lastPatientFinishedAt?: Date;
}> => {
    const { db } = getFirebase();
    const patientsRef = collection(db, 'patients');
    
    // Query all patients for this doctor/clinic/day
    const q = query(
        patientsRef,
        where('doctorId', '==', doctorId),
        where('clinicId', '==', clinicId),
        where('bookingDay', '==', bookingDay)
    );
    
    const snapshot = await getDocs(q);
    
    let totalWaitingCount = 0;
    let totalFinishedCount = 0;
    let totalWaitTimeMinutes = 0;
    let finishedWithWaitTime = 0;
    let queueStartedAt: Date | undefined;
    let lastPatientFinishedAt: Date | undefined;
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        if (data.status === 'Waiting') {
            totalWaitingCount++;
        } else if (data.status === 'Finished') {
            totalFinishedCount++;
            
            // Calculate wait time if we have both creation and consulting start times
            if (data.createdAt && data.consultingStartTime) {
                const createdAt = data.createdAt instanceof Timestamp 
                    ? data.createdAt.toDate() 
                    : new Date(data.createdAt);
                const consultingStartTime = data.consultingStartTime instanceof Timestamp 
                    ? data.consultingStartTime.toDate() 
                    : new Date(data.consultingStartTime);
                
                const waitTimeMs = consultingStartTime.getTime() - createdAt.getTime();
                const waitTimeMinutes = waitTimeMs / (1000 * 60);
                
                if (waitTimeMinutes > 0 && waitTimeMinutes < 480) { // Max 8 hours
                    totalWaitTimeMinutes += waitTimeMinutes;
                    finishedWithWaitTime++;
                }
            }
            
            // Track last finished time
            if (data.finishedAt) {
                const finishedAt = data.finishedAt instanceof Timestamp 
                    ? data.finishedAt.toDate() 
                    : new Date(data.finishedAt);
                if (!lastPatientFinishedAt || finishedAt > lastPatientFinishedAt) {
                    lastPatientFinishedAt = finishedAt;
                }
            }
        } else if (data.status === 'Consulting') {
            // Track when queue started (first consulting patient)
            if (data.consultingStartTime) {
                const startTime = data.consultingStartTime instanceof Timestamp 
                    ? data.consultingStartTime.toDate() 
                    : new Date(data.consultingStartTime);
                if (!queueStartedAt || startTime < queueStartedAt) {
                    queueStartedAt = startTime;
                }
            }
        }
    });
    
    // Calculate average wait time
    const averageWaitTimeMinutes = finishedWithWaitTime > 0 
        ? Math.round(totalWaitTimeMinutes / finishedWithWaitTime) 
        : 0;
    
    return {
        totalWaitingCount,
        totalFinishedCount,
        averageWaitTimeMinutes,
        queueStartedAt,
        lastPatientFinishedAt,
    };
};

export interface NewPatient {
    name: string;
    phone: string;
    bookingDate: Date;
    bookingDay?: string;              // Added: canonical day string "YYYY-MM-DD" (Cairo timezone)
    age: number | null;
    chronicDiseases: string | null;
    consultationReason: string | null;
    queueType: QueueType;
    doctorId?: string;
    nurseId?: string;
    nurseName?: string;
    prescription?: string;
    clinicId?: string;                // Added: multi-tenant clinic ID (optional for backward compatibility)
    source?: 'patient' | 'nurse';     // Added: indicates how patient was registered
    ticketId?: string;                // Added: reference to bookingTickets/{ticketId} for public status
}

export interface PatientInQueue extends NewPatient {
    id: string;
    queueNumber: number;
    status: PatientStatus;
    createdAt: Timestamp;
    consultingStartTime?: Timestamp; // Timestamp when consultation started (status changed to 'Consulting')
    finishedAt?: Timestamp; // Timestamp when consultation finished (status changed to 'Finished')
}

export interface ClinicSettings {
    consultationTime: number;
    consultationCost: number;
    reConsultationCost: number;
}

export interface DoctorProfile {
    name: string;
    specialty: string;
    clinicPhoneNumbers: string[];
    locations: string[];
    avatarUrl?: string;
    isAvailable?: boolean;
    isActive?: boolean;
    totalRevenue?: number;
}

export interface NurseProfile {
    uid?: string;
    name: string;
    email: string;
    clinicId?: string;
    doctorId?: string; // The doctor this nurse is assigned to
    isActive?: boolean;
    avatarUrl?: string;
}

// ============================================================================
// REMOVED FUNCTIONS - Now handled by /api/public/book
// ============================================================================
// - getNextQueueNumber: Moved to server-side API for atomic queue numbering
// - checkIfPatientExists: Moved to server-side API
// - addPatientToQueue: Replaced by unified /api/public/book endpoint
//
// All bookings now go through /api/public/book for consistency.
// This prevents queue numbering conflicts between nurse and patient bookings.
// ============================================================================

// Listen for real-time updates to the queue (for doctor/history view)
// Updated for multi-tenant: accepts optional clinicId for data scoping
export const listenToQueue = (
    doctorId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void,
    clinicId?: string  // Added: optional clinic filter
) => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');

    // Build query constraints
    const constraints: any[] = [where("doctorId", "==", doctorId)];

    // Add clinicId filter if provided (multi-tenant mode)
    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    constraints.push(orderBy("queueNumber"));

    const q = query(patientsCollection, ...constraints);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const patients: PatientInQueue[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Fallback for bookingDate to prevent crashes if data is missing
            const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
            const patient: PatientInQueue = {
                id: doc.id,
                name: data.name,
                phone: data.phone,
                bookingDate: bookingDateTimestamp.toDate(),
                age: data.age,
                chronicDiseases: data.chronicDiseases,
                consultationReason: data.consultationReason,
                queueNumber: data.queueNumber,
                status: data.status,
                createdAt: data.createdAt,
                queueType: data.queueType || 'Consultation',
                doctorId: data.doctorId,
                nurseId: data.nurseId,
                nurseName: data.nurseName,
                prescription: data.prescription,
                clinicId: data.clinicId,  // Added: include clinicId in response
            };
            patients.push(patient);
        });
        callback(patients);
    }, (error) => {
        logger.error("Error listening to queue", error);
        if (errorCallback) {
            errorCallback(error);
        }
    });

    return unsubscribe; // Return the unsubscribe function to clean up the listener
}

// Listen for real-time updates for a specific nurse's patients
// Updated for multi-tenant: accepts optional clinicId for data scoping
export const listenToQueueForNurse = (
    doctorId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void,
    clinicId?: string  // Added: optional clinic filter
) => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');

    // Build query constraints
    const constraints = [where("doctorId", "==", doctorId)];

    // Add clinicId filter if provided (multi-tenant mode)
    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    const q = query(patientsCollection, ...constraints);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const patients: PatientInQueue[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
            const patient: PatientInQueue = {
                id: doc.id,
                name: data.name,
                phone: data.phone,
                bookingDate: bookingDateTimestamp.toDate(),
                age: data.age,
                chronicDiseases: data.chronicDiseases,
                consultationReason: data.consultationReason,
                queueNumber: data.queueNumber,
                status: data.status,
                createdAt: data.createdAt,
                queueType: data.queueType || 'Consultation',
                doctorId: data.doctorId,
                nurseId: data.nurseId,
                nurseName: data.nurseName,
                prescription: data.prescription,
                clinicId: data.clinicId,  // Added: include clinicId in response
            };
            patients.push(patient);
        });
        callback(patients);
    }, (error) => {
        logger.error("Error listening to nurse's queue", error);
        if (errorCallback) {
            errorCallback(error);
        }
    });

    return unsubscribe;
};


// Get an active patient by phone number for a specific doctor
// Updated for multi-tenant: accepts optional clinicId for data scoping
export const getPatientByPhone = async (phone: string, doctorId: string, clinicId?: string): Promise<PatientInQueue | null> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');

    // Build query constraints
    const baseConstraints = [
        where("phone", "==", phone),
        where("doctorId", "==", doctorId),
        or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
    ];

    // Add clinicId filter if provided (multi-tenant mode)
    if (clinicId) {
        baseConstraints.unshift(where("clinicId", "==", clinicId));
    }

    const q = query(
        patientsCollection,
        and(...baseConstraints),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
    return {
        id: doc.id,
        ...data,
        bookingDate: bookingDateTimestamp.toDate(),
        clinicId: data.clinicId,  // Added: include clinicId in response
    } as PatientInQueue;
}

// Get an active patient by phone number across all doctors (for patient search)
export const getPatientByPhoneAcrossClinics = async (phone: string): Promise<PatientInQueue | null> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const q = query(
        patientsCollection, 
        and(
            where("phone", "==", phone), 
            or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
        ),
        limit(1)
    );
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
    return { 
        id: doc.id,
        ...data,
        bookingDate: bookingDateTimestamp.toDate(),
    } as PatientInQueue;
}


// Update a patient's status
// Updated: also updates booking ticket status if ticketId exists
// Updated: sets consultingStartTime when status changes to 'Consulting' for accurate wait time calculation
// Updated: updates queue statistics in queueState
export const updatePatientStatus = async (patientId: string, status: PatientStatus, prescription?: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);
    const updateData: any = { status };
    if (prescription) {
        updateData.prescription = prescription;
    }
    // Set consultingStartTime when status changes to 'Consulting'
    if (status === 'Consulting') {
        updateData.consultingStartTime = Timestamp.now();
    }
    await updateDoc(patientDocRef, updateData);

    // Get patient data for ticket and queueState updates
    const patientSnap = await getDoc(patientDocRef);
    if (patientSnap.exists()) {
        const patientData = patientSnap.data();
        const ticketId = patientData.ticketId;
        const clinicId = patientData.clinicId;
        const doctorId = patientData.doctorId;
        const queueNumber = patientData.queueNumber;
        const bookingDay = patientData.bookingDay;
        
        // Update booking ticket status if ticketId exists
        if (ticketId) {
            const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');
            await updateBookingTicketStatus(ticketId, status);
        }

        // Update queueState if patient is now consulting
        if (status === 'Consulting' && clinicId && doctorId && queueNumber !== undefined) {
            const { updateQueueState, updateQueueStats } = await import('@/services/queueStateService');
            await updateQueueState(clinicId, doctorId, queueNumber);
            
            // Update queue statistics
            if (bookingDay) {
                const stats = await calculateQueueStats(doctorId, clinicId, bookingDay);
                await updateQueueStats(clinicId, doctorId, stats);
            }
        }
    }
}

// Update the doctor's total revenue
export const updateDoctorRevenue = async (doctorId: string, amount: number) => {
    const { db } = getFirebase();
    const doctorRef = doc(db, 'doctors', doctorId);
    // Use the Firestore 'increment' FieldValue to add to the existing revenue.
    await setDoc(doctorRef, { totalRevenue: increment(amount) }, { merge: true });
}

// Finish consultation for current patient (marks as Finished)
// Updated: also updates booking ticket status and queueState
// Updated: updates queue statistics for accurate wait time calculation
export const finishConsultation = async (patientId: string, prescription?: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);

    // Update patient status to Finished and record finish time
    const updateData: any = {
        status: 'Finished',
        finishedAt: Timestamp.now() // Record exact finish time for accurate tracking
    };
    if (prescription) {
        updateData.prescription = prescription;
    }
    await updateDoc(patientDocRef, updateData);

    // Get patient data for ticket and queueState updates
    const patientSnap = await getDoc(patientDocRef);
    if (patientSnap.exists()) {
        const patientData = patientSnap.data();
        const ticketId = patientData.ticketId;
        const clinicId = patientData.clinicId;
        const doctorId = patientData.doctorId;
        const queueNumber = patientData.queueNumber;
        const bookingDay = patientData.bookingDay;

        // Update booking ticket status if ticketId exists
        if (ticketId) {
            const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');
            await updateBookingTicketStatus(ticketId, 'Finished');
        }

        // Update queueState to clear the current patient (set to null) and update stats
        if (clinicId && doctorId) {
            const { updateQueueState, updateQueueStats } = await import('@/services/queueStateService');
            await updateQueueState(clinicId, doctorId, null, {
                lastPatientFinishedAt: new Date(),
            });
            
            // Update queue statistics
            if (bookingDay) {
                const stats = await calculateQueueStats(doctorId, clinicId, bookingDay);
                await updateQueueStats(clinicId, doctorId, stats);
            }
        }
    }

    logger.debug(`Finished consultation for patient`, { patientId });
};

// Finish a consultation and call the next patient
// Updated: also updates booking ticket statuses if ticketIds exist
// Updated: also updates queueState for real-time status page
// Updated: sets consultingStartTime when calling next patient for accurate wait time calculation
export const finishAndCallNext = async (currentPatientId: string, nextPatientId: string, prescription?: string) => {
    const { db } = getFirebase();
    const batch = writeBatch(db);

    const finishedPatientRef = doc(db, 'patients', currentPatientId);
    const updateData: any = {
        status: 'Finished',
        finishedAt: Timestamp.now() // Record exact finish time
    };
    if (prescription) {
        updateData.prescription = prescription;
    }
    batch.update(finishedPatientRef, updateData);

    const nextPatientRef = doc(db, 'patients', nextPatientId);
    batch.update(nextPatientRef, {
        status: 'Consulting',
        consultingStartTime: Timestamp.now() // Set start time for accurate wait time calculation
    });

    await batch.commit();

    // Update booking ticket statuses
    const finishedPatientSnap = await getDoc(finishedPatientRef);
    const nextPatientSnap = await getDoc(nextPatientRef);

    const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');

    if (finishedPatientSnap.exists()) {
        const ticketId = finishedPatientSnap.data().ticketId;
        if (ticketId) {
            await updateBookingTicketStatus(ticketId, 'Finished');
        }
    }

    if (nextPatientSnap.exists()) {
        const nextPatientData = nextPatientSnap.data();
        const ticketId = nextPatientData.ticketId;
        const clinicId = nextPatientData.clinicId;
        const doctorId = nextPatientData.doctorId;
        const queueNumber = nextPatientData.queueNumber;
        
        if (ticketId) {
            await updateBookingTicketStatus(ticketId, 'Consulting');
        }

        // Update queueState for real-time status page
        if (clinicId && doctorId && queueNumber !== undefined) {
            const { updateQueueState } = await import('@/services/queueStateService');
            await updateQueueState(clinicId, doctorId, queueNumber);
        }
    }
}

// Remove a patient from the queue (client-side)
// Reorganize queue numbers after a patient is removed
// Decrements queue numbers for all patients after the removed patient on the same day/doctor
export const reorganizeQueue = async (
    deletedQueueNumber: number,
    bookingDay: string,
    doctorId: string,
    clinicId?: string
) => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');

    // Build query to find all patients with higher queue numbers on the same day
    const constraints = [
        where("doctorId", "==", doctorId),
        where("bookingDay", "==", bookingDay),
        where("queueNumber", ">", deletedQueueNumber),
        or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
    ];

    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    const q = query(patientsCollection, and(...constraints));
    const snapshot = await getDocs(q);

    // Update each patient's queue number (decrement by 1)
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnapshot) => {
        const patientRef = doc(db, 'patients', docSnapshot.id);
        const currentQueueNumber = docSnapshot.data().queueNumber;
        batch.update(patientRef, { queueNumber: currentQueueNumber - 1 });
    });

    await batch.commit();
    logger.debug(`Reorganized patients after queue deletion`, { count: snapshot.size, deletedQueueNumber });
};

// Remove a patient from the queue and reorganize queue numbers
export const removePatientFromQueue = async (patientId: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);

    // Get patient data before deletion for reorganization
    const patientSnap = await getDoc(patientDocRef);
    if (!patientSnap.exists()) {
        throw new Error("Patient not found");
    }

    const patientData = patientSnap.data();
    const queueNumber = patientData.queueNumber;
    const bookingDay = patientData.bookingDay;
    const doctorId = patientData.doctorId;
    const clinicId = patientData.clinicId;

    // Delete the patient
    await deleteDoc(patientDocRef);

    // Reorganize queue if patient was waiting or consulting
    if ((patientData.status === 'Waiting' || patientData.status === 'Consulting') && bookingDay && doctorId && queueNumber) {
        await reorganizeQueue(queueNumber, bookingDay, doctorId, clinicId);
    }
};

// Doctor Message Type
export interface DoctorMessage {
    id?: string;
    doctorId: string;
    clinicId: string;
    message: string;
    createdAt: any; // Firestore Timestamp
    isRead: boolean; // For nurse notifications
}

// Update the doctor's global message (new system)
export const updateDoctorMessage = async (message: string, doctorId: string, clinicId?: string) => {
    const { db } = getFirebase();
    
    // If no clinicId provided, fallback to old system for backward compatibility
    if (!clinicId) {
        const statusDocRef = doc(db, 'clinicInfo', 'status');
        await setDoc(statusDocRef, { [`message_${doctorId}`]: message }, { merge: true });
        return;
    }
    
    // New system: Save message to collection with timestamp
    const messagesRef = collection(db, 'doctorMessages');
    await addDoc(messagesRef, {
        doctorId,
        clinicId,
        message,
        createdAt: serverTimestamp(),
        isRead: false // For nurse notifications
    } as Omit<DoctorMessage, 'id'>);
    
    // Also update the old location for backward compatibility
    const statusDocRef = doc(db, 'clinicInfo', 'status');
    await setDoc(statusDocRef, { [`message_${doctorId}`]: message }, { merge: true });
};

// Listen to the doctor's global message (old system - backward compatibility)
export const listenToDoctorMessage = (doctorId: string, callback: (message: string) => void) => {
    const { db } = getFirebase();
    const statusDocRef = doc(db, 'clinicInfo', 'status');
    const unsubscribe = onSnapshot(statusDocRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data()[`message_${doctorId}`] || "");
        } else {
            callback("");
        }
    }, (error) => {
        logger.error("Error listening to doctor message", error);
    });
    return unsubscribe;
};

// Get latest doctor message with timestamp
export const getLatestDoctorMessage = async (doctorId: string, clinicId: string): Promise<DoctorMessage | null> => {
    const { db } = getFirebase();
    const messagesRef = collection(db, 'doctorMessages');
    const q = query(
        messagesRef,
        where('doctorId', '==', doctorId),
        where('clinicId', '==', clinicId),
        orderBy('createdAt', 'desc'),
        limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as DoctorMessage;
};

// Listen to new doctor messages (for nurse notifications)
export const listenToNewDoctorMessages = (
    clinicId: string,
    callback: (messages: DoctorMessage[]) => void,
    onlyUnread: boolean = true
) => {
    const { db } = getFirebase();
    const messagesRef = collection(db, 'doctorMessages');
    
    let q = query(
        messagesRef,
        where('clinicId', '==', clinicId),
        orderBy('createdAt', 'desc'),
        limit(10)
    );
    
    if (onlyUnread) {
        q = query(
            messagesRef,
            where('clinicId', '==', clinicId),
            where('isRead', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as DoctorMessage));
        callback(messages);
    }, (error) => {
        logger.error('Error listening to doctor messages', error);
    });
    
    return unsubscribe;
};

// Mark message as read
export const markMessageAsRead = async (messageId: string) => {
    const { db } = getFirebase();
    const messageRef = doc(db, 'doctorMessages', messageId);
    await updateDoc(messageRef, { isRead: true });
};

// Update clinic settings
export const updateClinicSettings = async (settings: ClinicSettings) => {
    const { db } = getFirebase();
    const settingsDocRef = doc(db, 'clinicInfo', 'settings');
    return await setDoc(settingsDocRef, settings, { merge: true });
};

// Get clinic settings once
export const getClinicSettings = async (): Promise<ClinicSettings | null> => {
    const { db } = getFirebase();
    const settingsDocRef = doc(db, 'clinicInfo', 'settings');
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
        return docSnap.data() as ClinicSettings;
    }
    return null;
}

// Listen to clinic settings
export const listenToClinicSettings = (
    callback: (settings: ClinicSettings | null) => void,
    clinicId?: string
) => {
    const { db } = getFirebase();
    
    if (clinicId) {
        // Multi-tenant: settings are in the clinic document
        const clinicDocRef = doc(db, 'clinics', clinicId);
        return onSnapshot(clinicDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                callback(data.settings as ClinicSettings || null);
            } else {
                callback(null);
            }
        }, (error) => {
            logger.error("Error listening to clinic settings (multi-tenant)", error);
        });
    } else {
        // Legacy: settings are in clinicInfo/settings
        const settingsDocRef = doc(db, 'clinicInfo', 'settings');
        return onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data() as ClinicSettings);
            } else {
                callback(null);
            }
        }, (error) => {
            logger.error("Error listening to clinic settings (legacy)", error);
        });
    }
};

// --- Doctor Profile Functions ---

// Get all doctors' profiles (for report generation)
export const getAllDoctors = async (): Promise<DoctorProfile[]> => {
    const { db } = getFirebase();
    const doctorsCollection = collection(db, 'doctors');
    const snapshot = await getDocs(doctorsCollection);
    const doctors: DoctorProfile[] = [];
    snapshot.forEach(doc => {
        doctors.push(doc.data() as DoctorProfile);
    });
    return doctors;
}

// Get a doctor's profile
export const getDoctorProfile = async (uid: string): Promise<DoctorProfile | null> => {
    const { db } = getFirebase();
    const docRef = doc(db, 'doctors', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as DoctorProfile;
    }
    return null;
}

// Listen to a doctor's profile
export const listenToDoctorProfile = (uid: string, callback: (profile: DoctorProfile | null) => void) => {
    const { db } = getFirebase();
    const docRef = doc(db, 'doctors', uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as DoctorProfile);
        } else {
            callback(null);
        }
    }, (error) => {
        logger.error("Error listening to doctor profile", error);
    });
    return unsubscribe;
};

// Listen to a doctor's availability
export const listenToDoctorAvailability = (doctorId: string, callback: (isAvailable: boolean) => void) => {
    const { db } = getFirebase();
    const docRef = doc(db, 'doctors', doctorId);
    const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const doctorData = doc.data() as DoctorProfile;
            callback(doctorData.isAvailable ?? true);
        } else {
            // Default to available if no doctor profile is found
            callback(true);
        }
    }, (error) => {
        logger.error("Error listening to doctor availability", error);
    });

    return unsubscribe;
};


// --- Nurse Profile Functions ---

// Get a nurse's profile
export const getNurseProfile = async (uid: string): Promise<NurseProfile | null> => {
    const { db } = getFirebase();
    const docRef = doc(db, 'nurses', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as NurseProfile;
    }
    return null;
}

// Set/Update a nurse's profile
export const setNurseProfile = async (uid: string, profile: Partial<NurseProfile>) => {
    const { db } = getFirebase();
    const docRef = doc(db, 'nurses', uid);
    return await setDoc(docRef, profile, { merge: true });
}

// --- Report Functions ---

// Get patients from the last 30 days for a specific doctor
export const getPatientsForLast30Days = async (doctorId: string): Promise<PatientInQueue[]> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    const q = query(
        patientsCollection,
        where("doctorId", "==", doctorId),
        where("bookingDate", ">=", startTimestamp),
        orderBy("bookingDate", "desc")
    );

    const snapshot = await getDocs(q);
    const patients: PatientInQueue[] = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
        patients.push({
            id: doc.id,
            ...data,
            bookingDate: bookingDateTimestamp.toDate(),
        } as PatientInQueue);
    });

    return patients;
};

export const getPreviousBookings = async (
    doctorId: string, 
    startDate: Date, 
    endDate: Date,
    clinicId?: string
): Promise<PatientInQueue[]> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const startTimestamp = Timestamp.fromDate(startDate);
    // Add one day to the end date to include the entire day in the query
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    const constraints = [
        where("doctorId", "==", doctorId),
        where("bookingDate", ">=", startTimestamp),
        where("bookingDate", "<=", endTimestamp),
    ];

    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    const q = query(
        patientsCollection,
        ...constraints,
        orderBy("bookingDate", "desc")
    );

    const snapshot = await getDocs(q);
    const bookings: PatientInQueue[] = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
        bookings.push({
            id: doc.id,
            ...data,
            bookingDate: bookingDateTimestamp.toDate(),
        } as PatientInQueue);
    });

    return bookings;
};

// Set/Update a doctor's profile
export const setDoctorProfile = async (uid: string, profile: Partial<DoctorProfile>) => {
    const { db } = getFirebase();
    const docRef = doc(db, 'doctors', uid);
    const docSnap = await getDoc(docRef);

    const profileData = { ...profile };

    // If the doctor profile does not exist (it's a new doctor),
    // and `isAvailable` is not already defined, set it to true.
    if (!docSnap.exists() && typeof profileData.isAvailable === 'undefined') {
        profileData.isAvailable = true;
    }

    return await setDoc(docRef, profileData, { merge: true });
}

// --- Multi-Tenant Doctor/Nurse Creation ---

/**
 * Create a doctor document for multi-tenant system
 * Document ID is auto-generated (not auth UID)
 */
export const createDoctorDocument = async (doctorData: {
    uid: string;
    clinicId: string;
    name: string;
    email: string;
    specialty?: string;
}): Promise<string> => {
    const { db } = getFirebase();
    // Use uid as document ID for consistent access control
    const doctorRef = doc(db, 'doctors', doctorData.uid);

    const newDoctor = {
        uid: doctorData.uid, // Add uid field for rules
        userId: doctorData.uid, // Maps to Firebase Auth UID
        clinicId: doctorData.clinicId,
        name: doctorData.name,
        email: doctorData.email,
        specialty: doctorData.specialty || '',
        isActive: true,
        isAvailable: true,
        totalRevenue: 0,
        clinicPhoneNumbers: [],
        locations: [],
        createdAt: Timestamp.now(),
        addedBy: doctorData.uid,
    };

    await setDoc(doctorRef, newDoctor);
    return doctorData.uid;
};

/**
 * Create a nurse document for multi-tenant system
 * Document ID uses auth UID for consistent access control
 */
export const createNurseDocument = async (nurseData: {
    uid: string;
    clinicId: string;
    name: string;
    email: string;
}): Promise<string> => {
    const { db } = getFirebase();
    // Use uid as document ID for consistent access control
    const nurseRef = doc(db, 'nurses', nurseData.uid);

    const newNurse = {
        uid: nurseData.uid, // Add uid field for rules
        userId: nurseData.uid, // Maps to Firebase Auth UID
        clinicId: nurseData.clinicId,
        name: nurseData.name,
        email: nurseData.email,
        isActive: true,
        createdAt: Timestamp.now(),
        addedBy: nurseData.uid,
    };

    await setDoc(nurseRef, newNurse);
    return nurseData.uid;
};

/**
 * Get all doctors for a clinic
 */
export const getClinicDoctors = async (clinicId: string): Promise<any[]> => {
    const { db } = getFirebase();
    const doctorsCollection = collection(db, 'doctors');
    const q = query(doctorsCollection, where('clinicId', '==', clinicId));
    const snapshot = await getDocs(q);

    const doctors: any[] = [];
    snapshot.forEach((doc) => {
        doctors.push({
            id: doc.id,
            ...doc.data(),
        });
    });

    return doctors;
};

/**
 * Get all nurses for a clinic
 */
export const getClinicNurses = async (clinicId: string): Promise<any[]> => {
    const { db } = getFirebase();
    const nursesCollection = collection(db, 'nurses');
    const q = query(nursesCollection, where('clinicId', '==', clinicId));
    const snapshot = await getDocs(q);

    const nurses: any[] = [];
    snapshot.forEach((doc) => {
        nurses.push({
            id: doc.id,
            ...doc.data(),
        });
    });

    return nurses;
};

/**
 * Listen to clinic-wide queue (for nurses to see all patients in their clinic)
 * Filters by clinicId instead of doctorId, showing all today's patients
 *
 * @param clinicId - Clinic ID
 * @param callback - Callback function for patient updates
 * @param errorCallback - Optional error handler
 * @param options - Optional filters (doctorId, status, date)
 */
export const listenToClinicQueue = (
    clinicId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void,
    options?: {
        doctorId?: string;       // Optional filter by specific doctor
        status?: PatientStatus;  // Optional filter by status
        includeFinished?: boolean; // Include finished patients (default: false)
    }
) => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');

    // Get today's bookingDay (Cairo timezone)
    const today = getCairoBookingDay(); // "YYYY-MM-DD"

    // Build base query constraints (must be wrapped in and() when using or())
    const baseConstraints: any[] = [
        where("clinicId", "==", clinicId),
        where("bookingDay", "==", today), // Use canonical bookingDay field
    ];

    // Optional filters
    if (options?.doctorId) {
        baseConstraints.push(where("doctorId", "==", options.doctorId));
    }

    if (options?.status) {
        baseConstraints.push(where("status", "==", options.status));
    } else if (!options?.includeFinished) {
        // Default: exclude finished patients (use or() within and())
        baseConstraints.push(or(
            where("status", "==", "Waiting"),
            where("status", "==", "Consulting")
        ));
    }

    // When using or(), wrap all constraints in and()
    const hasOrFilter = !options?.status && !options?.includeFinished;
    const q = hasOrFilter 
        ? query(patientsCollection, and(...baseConstraints), orderBy("queueNumber", "asc"))
        : query(patientsCollection, ...baseConstraints, orderBy("queueNumber", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const patients: PatientInQueue[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const bookingDateTimestamp = data.bookingDate || data.createdAt || Timestamp.now();
            const patient: PatientInQueue = {
                id: doc.id,
                name: data.name,
                phone: data.phone,
                bookingDate: bookingDateTimestamp.toDate(),
                bookingDay: data.bookingDay, // Include bookingDay in result
                age: data.age,
                chronicDiseases: data.chronicDiseases,
                consultationReason: data.consultationReason,
                queueNumber: data.queueNumber,
                status: data.status,
                createdAt: data.createdAt,
                queueType: data.queueType || 'Consultation',
                doctorId: data.doctorId,
                nurseId: data.nurseId,
                nurseName: data.nurseName,
                prescription: data.prescription,
                clinicId: data.clinicId,
                ticketId: data.ticketId,
            };
            patients.push(patient);
        });
        callback(patients);
    }, (error) => {
        logger.error("Error listening to clinic queue", error);
        if (errorCallback) {
            errorCallback(error);
        }
    });

    return unsubscribe;
};
