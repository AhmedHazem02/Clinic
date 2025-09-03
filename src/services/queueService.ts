
import { db } from "@/lib/firebase";
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
    name: string;
    email: string;
    avatarUrl?: string;
}


// Get collections
const patientsCollection = collection(db, 'patients');
const clinicInfoCollection = collection(db, 'clinicInfo');
const doctorsCollection = collection(db, 'doctors');
const nursesCollection = collection(db, 'nurses');


// Get the next queue number
const getNextQueueNumber = async (doctorId: string): Promise<number> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);

    const q = query(
        patientsCollection, 
        where("doctorId", "==", doctorId),
        where("createdAt", ">=", startOfToday),
        orderBy("createdAt", "desc"), 
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return 1;
    }
    const lastPatient = snapshot.docs[0].data();
    return (lastPatient.queueNumber || 0) + 1;
}

// Check if a patient has any previous record with a doctor
const checkIfPatientExists = async (phone: string, doctorId: string): Promise<boolean> => {
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
export const addPatientToQueue = async (patientData: NewPatient) => {
    if (!patientData.doctorId) {
        throw new Error("Doctor ID is required to add a patient.");
    }

    // Check if patient with the same phone number is already waiting or consulting for this doctor
    const existingPatientQuery = query(
        patientsCollection,
        and(
            where("phone", "==", patientData.phone),
            where("doctorId", "==", patientData.doctorId),
            or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
        )
    );
    const existingPatientSnapshot = await getDocs(existingPatientQuery);

    if (!existingPatientSnapshot.empty) {
        throw new Error("A patient with this phone number is already in the queue for this doctor.");
    }
    
    // If it's a re-consultation, check if the patient has a prior record.
    if (patientData.queueType === 'Re-consultation') {
        const patientExists = await checkIfPatientExists(patientData.phone, patientData.doctorId);
        if (!patientExists) {
            throw new Error("Patient not found for re-consultation. A patient must have a previous consultation to book a re-consultation.");
        }
    }


    const queueNumber = await getNextQueueNumber(patientData.doctorId);

    const newPatientDoc = {
        ...patientData,
        bookingDate: Timestamp.fromDate(patientData.bookingDate),
        queueNumber,
        status: 'Waiting' as PatientStatus,
        createdAt: Timestamp.now(),
        prescription: "",
    };

    return await addDoc(patientsCollection, newPatientDoc);
}

// Listen for real-time updates to the queue (for doctor/history view)
export const listenToQueue = (
    doctorId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const q = query(
        patientsCollection,
        where("doctorId", "==", doctorId),
        orderBy("queueNumber")
    );

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
export const listenToQueueForNurse = (
    doctorId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const q = query(
        patientsCollection,
        where("doctorId", "==", doctorId)
    );

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
export const getPatientByPhone = async (phone: string, doctorId: string): Promise<PatientInQueue | null> => {
    const q = query(
        patientsCollection, 
        and(
            where("phone", "==", phone), 
            where("doctorId", "==", doctorId),
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

// Get an active patient by phone number across all doctors (for patient search)
export const getPatientByPhoneAcrossClinics = async (phone: string): Promise<PatientInQueue | null> => {
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
export const updatePatientStatus = async (patientId: string, status: PatientStatus, prescription?: string) => {
    const patientDocRef = doc(patientsCollection, patientId);
    const updateData: { status: PatientStatus, prescription?: string } = { status };
    if (prescription) {
        updateData.prescription = prescription;
    }
    return await updateDoc(patientDocRef, updateData);
}

// Update the doctor's total revenue
export const updateDoctorRevenue = async (doctorId: string, amount: number) => {
    const doctorRef = doc(doctorsCollection, doctorId);
    // Use the Firestore 'increment' FieldValue to add to the existing revenue.
    await setDoc(doctorRef, { totalRevenue: increment(amount) }, { merge: true });
}

// Finish a consultation and call the next patient
export const finishAndCallNext = async (currentPatientId: string, nextPatientId: string, prescription?: string) => {
    const batch = writeBatch(db);
    
    const finishedPatientRef = doc(patientsCollection, currentPatientId);
    const updateData: { status: PatientStatus, prescription?: string } = { status: 'Finished' };
    if (prescription) {
        updateData.prescription = prescription;
    }
    batch.update(finishedPatientRef, updateData);

    const nextPatientRef = doc(patientsCollection, nextPatientId);
    batch.update(nextPatientRef, { status: 'Consulting' });
    
    await batch.commit();
}

// Remove a patient from the queue
export const removePatientFromQueue = async (patientId: string) => {
    const patientDocRef = doc(patientsCollection, patientId);
    return await deleteDoc(patientDocRef);
};

// Update the doctor's global message
export const updateDoctorMessage = async (message: string, doctorId: string) => {
    const statusDocRef = doc(clinicInfoCollection, 'status');
    // Store message per doctor
    await setDoc(statusDocRef, { [`message_${doctorId}`]: message }, { merge: true });
};

// Listen to the doctor's global message
export const listenToDoctorMessage = (doctorId: string, callback: (message: string) => void) => {
    const statusDocRef = doc(clinicInfoCollection, 'status');
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
    const settingsDocRef = doc(clinicInfoCollection, 'settings');
    return await setDoc(settingsDocRef, settings, { merge: true });
};

// Get clinic settings once
export const getClinicSettings = async (): Promise<ClinicSettings | null> => {
    const settingsDocRef = doc(clinicInfoCollection, 'settings');
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
        return docSnap.data() as ClinicSettings;
    }
    return null;
}

// Listen to clinic settings
export const listenToClinicSettings = (callback: (settings: ClinicSettings | null) => void) => {
    const settingsDocRef = doc(clinicInfoCollection, 'settings');
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
    const snapshot = await getDocs(doctorsCollection);
    const doctors: DoctorProfile[] = [];
    snapshot.forEach(doc => {
        doctors.push(doc.data() as DoctorProfile);
    });
    return doctors;
}

// Get a doctor's profile
export const getDoctorProfile = async (uid: string): Promise<DoctorProfile | null> => {
    const docRef = doc(doctorsCollection, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as DoctorProfile;
    }
    return null;
}

// Listen to a doctor's profile
export const listenToDoctorProfile = (uid: string, callback: (profile: DoctorProfile | null) => void) => {
    const docRef = doc(doctorsCollection, uid);
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
    const docRef = doc(doctorsCollection, doctorId);
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
    const docRef = doc(nursesCollection, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as NurseProfile;
    }
    return null;
}

// Set/Update a nurse's profile
export const setNurseProfile = async (uid: string, profile: Partial<NurseProfile>) => {
    const docRef = doc(nursesCollection, uid);
    return await setDoc(docRef, profile, { merge: true });
}

// --- Report Functions ---

// Get patients from the last 30 days for a specific doctor
export const getPatientsForLast30Days = async (doctorId: string): Promise<PatientInQueue[]> => {
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

// Set/Update a doctor's profile
export const setDoctorProfile = async (uid: string, profile: Partial<DoctorProfile>) => {
    const docRef = doc(db, 'doctors', uid);
    return await setDoc(docRef, profile, { merge: true });
}
