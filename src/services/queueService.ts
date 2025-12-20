
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
    increment
} from "firebase/firestore";
import { getCairoBookingDay } from "@/lib/bookingDay";

export type PatientStatus = 'Waiting' | 'Consulting' | 'Finished';
export type QueueType = 'Consultation' | 'Re-consultation';

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
        console.error("Error listening to queue:", error);
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
        console.error("Error listening to nurse's queue:", error);
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
export const updatePatientStatus = async (patientId: string, status: PatientStatus, prescription?: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);
    const updateData: { status: PatientStatus, prescription?: string } = { status };
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
        
        // Update booking ticket status if ticketId exists
        if (ticketId) {
            const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');
            await updateBookingTicketStatus(ticketId, status);
        }

        // Update queueState if patient is now consulting
        if (status === 'Consulting' && clinicId && doctorId && queueNumber !== undefined) {
            const { updateQueueState } = await import('@/services/queueStateService');
            await updateQueueState(clinicId, doctorId, queueNumber);
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

// Finish a consultation and call the next patient
// Updated: also updates booking ticket statuses if ticketIds exist
// Updated: also updates queueState for real-time status page
export const finishAndCallNext = async (currentPatientId: string, nextPatientId: string, prescription?: string) => {
    const { db } = getFirebase();
    const batch = writeBatch(db);
    
    const finishedPatientRef = doc(db, 'patients', currentPatientId);
    const updateData: { status: PatientStatus, prescription?: string } = { status: 'Finished' };
    if (prescription) {
        updateData.prescription = prescription;
    }
    batch.update(finishedPatientRef, updateData);

    const nextPatientRef = doc(db, 'patients', nextPatientId);
    batch.update(nextPatientRef, { status: 'Consulting' });
    
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
export const removePatientFromQueue = async (patientId: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);
    return await deleteDoc(patientDocRef);
};

// Update the doctor's global message
export const updateDoctorMessage = async (message: string, doctorId: string) => {
    const { db } = getFirebase();
    const statusDocRef = doc(db, 'clinicInfo', 'status');
    // Store message per doctor
    await setDoc(statusDocRef, { [`message_${doctorId}`]: message }, { merge: true });
};

// Listen to the doctor's global message
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
        console.error("Error listening to doctor message:", error);
    });
    return unsubscribe;
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
            console.error("Error listening to clinic settings (multi-tenant):", error);
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
            console.error("Error listening to clinic settings (legacy):", error);
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
        console.error("Error listening to doctor profile:", error);
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
        console.error("Error listening to doctor availability:", error);
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
        console.error("Error listening to clinic queue:", error);
        if (errorCallback) {
            errorCallback(error);
        }
    });

    return unsubscribe;
};
