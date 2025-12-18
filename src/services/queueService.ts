
import { getFirebase } from "@/lib/firebase";
import {
    collection,
    addDoc,
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

export type PatientStatus = 'Waiting' | 'Consulting' | 'Finished';
export type QueueType = 'Consultation' | 'Re-consultation';

export interface NewPatient {
    name: string;
    phone: string;
    bookingDate: Date;
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
    isActive?: boolean;
    avatarUrl?: string;
}

// Get the next queue number
// Updated for multi-tenant: accepts optional clinicId for data scoping
const getNextQueueNumber = async (doctorId: string, clinicId?: string): Promise<number> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);

    // Build query with optional clinicId filter
    const constraints: any[] = [
        where("doctorId", "==", doctorId),
        where("createdAt", ">=", startOfToday),
    ];

    // Add clinicId filter if provided (multi-tenant mode)
    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(1));

    const q = query(patientsCollection, ...constraints);
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return 1;
    }
    const lastPatient = snapshot.docs[0].data();
    return (lastPatient.queueNumber || 0) + 1;
}

// Check if a patient has any previous record with a doctor
const checkIfPatientExists = async (phone: string, doctorId: string): Promise<boolean> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const q = query(
        patientsCollection,
        where("phone", "==", phone),
        where("doctorId", "==", doctorId),
        limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}


// Add a new patient to the queue
// Updated for multi-tenant: writes clinicId if provided
// Updated for Step 4: creates booking ticket for public status access
export const addPatientToQueue = async (patientData: NewPatient): Promise<{ wasCorrected: boolean; ticketId?: string; patientId?: string }> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    if (!patientData.doctorId) {
        throw new Error("Doctor ID is required to add a patient.");
    }

    // Build query constraints for checking existing patient
    const existingPatientConstraints = [
        where("phone", "==", patientData.phone),
        where("doctorId", "==", patientData.doctorId),
        or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
    ];

    // Add clinicId filter if provided (multi-tenant mode)
    if (patientData.clinicId) {
        existingPatientConstraints.unshift(where("clinicId", "==", patientData.clinicId));
    }

    // Check if patient with the same phone number is already waiting or consulting for this doctor
    const existingPatientQuery = query(
        patientsCollection,
        and(...existingPatientConstraints)
    );
    const existingPatientSnapshot = await getDocs(existingPatientQuery);

    if (!existingPatientSnapshot.empty) {
        throw new Error("A patient with this phone number is already in the queue for this doctor.");
    }

    let wasCorrected = false;
    // If it's a re-consultation, check if the patient has a prior record.
    if (patientData.queueType === 'Re-consultation') {
        const patientExists = await checkIfPatientExists(patientData.phone, patientData.doctorId);
        if (!patientExists) {
            // Patient doesn't exist, automatically switch them to a regular consultation.
            patientData.queueType = 'Consultation';
            wasCorrected = true;
        }
    }


    const queueNumber = await getNextQueueNumber(patientData.doctorId, patientData.clinicId);

    const newPatientDoc = {
        ...patientData,
        bookingDate: Timestamp.fromDate(patientData.bookingDate),
        queueNumber,
        status: 'Waiting' as PatientStatus,
        createdAt: Timestamp.now(),
        prescription: "",
    };

    // Ensure clinicId is included in the document if provided
    if (patientData.clinicId) {
        (newPatientDoc as any).clinicId = patientData.clinicId;
    }

    // Add patient document
    const patientDocRef = await addDoc(patientsCollection, newPatientDoc);
    const patientId = patientDocRef.id;

    // Create booking ticket if clinicId is present (multi-tenant mode)
    let ticketId: string | undefined;
    if (patientData.clinicId && patientData.doctorId) {
        const { createBookingTicket, sanitizeDisplayName, getPhoneLast4 } = await import('@/services/bookingTicketService');
        
        ticketId = await createBookingTicket({
            clinicId: patientData.clinicId,
            doctorId: patientData.doctorId,
            patientId: patientId,
            queueNumber: queueNumber,
            status: 'Waiting',
            displayName: sanitizeDisplayName(patientData.name),
            phoneLast4: getPhoneLast4(patientData.phone),
        });

        // Update patient document with ticketId
        await updateDoc(patientDocRef, { ticketId });
    }

    return { wasCorrected, ticketId, patientId };
}

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
    const constraints = [
        where("phone", "==", phone),
        where("doctorId", "==", doctorId),
        or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
    ];

    // Add clinicId filter if provided (multi-tenant mode)
    if (clinicId) {
        constraints.unshift(where("clinicId", "==", clinicId));
    }

    const q = query(
        patientsCollection,
        and(...constraints),
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
// Updated for Step 4: also updates booking ticket status if ticketId exists
// Updated for Step 5: maintains queueState for public status pages
export const updatePatientStatus = async (patientId: string, status: PatientStatus, prescription?: string) => {
    const { db } = getFirebase();
    const patientDocRef = doc(db, 'patients', patientId);
    const updateData: { status: PatientStatus, prescription?: string } = { status };
    if (prescription) {
        updateData.prescription = prescription;
    }
    await updateDoc(patientDocRef, updateData);

    // Get patient data for queue state and ticket updates
    const patientSnap = await getDoc(patientDocRef);
    if (patientSnap.exists()) {
        const patientData = patientSnap.data();
        const ticketId = patientData.ticketId;
        
        // Update booking ticket status if ticketId exists
        if (ticketId) {
            const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');
            await updateBookingTicketStatus(ticketId, status);
        }

        // Update queue state if patient is now consulting (Step 5: security)
        if (status === 'Consulting' && patientData.clinicId && patientData.doctorId) {
            const { updateQueueState } = await import('@/services/queueStateService');
            await updateQueueState(
                patientData.clinicId,
                patientData.doctorId,
                patientData.queueNumber
            );
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
// Updated for Step 4: also updates booking ticket statuses if ticketIds exist
// Updated for Step 5: maintains queueState for public status pages
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

    // Update booking ticket statuses and queue state
    const finishedPatientSnap = await getDoc(finishedPatientRef);
    const nextPatientSnap = await getDoc(nextPatientRef);

    const { updateBookingTicketStatus } = await import('@/services/bookingTicketService');
    const { updateQueueState } = await import('@/services/queueStateService');

    if (finishedPatientSnap.exists()) {
        const ticketId = finishedPatientSnap.data().ticketId;
        if (ticketId) {
            await updateBookingTicketStatus(ticketId, 'Finished');
        }
    }

    if (nextPatientSnap.exists()) {
        const nextPatientData = nextPatientSnap.data();
        const ticketId = nextPatientData.ticketId;
        
        if (ticketId) {
            await updateBookingTicketStatus(ticketId, 'Consulting');
        }

        // Update queue state to next patient's queue number (Step 5: security)
        if (nextPatientData.clinicId && nextPatientData.doctorId) {
            await updateQueueState(
                nextPatientData.clinicId,
                nextPatientData.doctorId,
                nextPatientData.queueNumber
            );
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
export const listenToClinicSettings = (callback: (settings: ClinicSettings | null) => void) => {
    const { db } = getFirebase();
    const settingsDocRef = doc(db, 'clinicInfo', 'settings');
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as ClinicSettings);
        } else {
            callback(null);
        }
    });
    return unsubscribe;
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
    endDate: Date
): Promise<PatientInQueue[]> => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const startTimestamp = Timestamp.fromDate(startDate);
    // Add one day to the end date to include the entire day in the query
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    const q = query(
        patientsCollection,
        where("doctorId", "==", doctorId),
        where("bookingDate", ">=", startTimestamp),
        where("bookingDate", "<=", endTimestamp),
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
