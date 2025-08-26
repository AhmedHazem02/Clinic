
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
    nurseId?: string;
    nurseName?: string;
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
    clinicPhoneNumber: string;
    locations: string[];
    avatarUrl?: string;
    isAvailable?: boolean;
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
const getNextQueueNumber = async (): Promise<number> => {
    const q = query(patientsCollection, orderBy("queueNumber", "desc"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return 1;
    }
    const lastPatient = snapshot.docs[0].data();
    return (lastPatient.queueNumber || 0) + 1;
}

// Add a new patient to the queue
export const addPatientToQueue = async (patientData: NewPatient) => {
    // Check if patient with the same phone number is already waiting or consulting
    const existingPatientQuery = query(
        patientsCollection,
        and(
            where("phone", "==", patientData.phone),
            or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
        )
    );
    const existingPatientSnapshot = await getDocs(existingPatientQuery);

    if (!existingPatientSnapshot.empty) {
        throw new Error("A patient with this phone number is already in the queue.");
    }

    const queueNumber = await getNextQueueNumber();

    const newPatientDoc = {
        ...patientData,
        bookingDate: Timestamp.fromDate(patientData.bookingDate),
        queueNumber,
        status: 'Waiting' as PatientStatus,
        createdAt: Timestamp.now(),
    };

    return await addDoc(patientsCollection, newPatientDoc);
}

// Listen for real-time updates to the queue (for doctor/history view)
export const listenToQueue = (
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const q = query(
        patientsCollection,
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
                nurseId: data.nurseId,
                nurseName: data.nurseName,
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
    nurseId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const q = query(
        patientsCollection,
        where("nurseId", "==", nurseId)
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
                nurseId: data.nurseId,
                nurseName: data.nurseName,
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


// Get an active patient by phone number
export const getPatientByPhone = async (phone: string): Promise<PatientInQueue | null> => {
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
export const updatePatientStatus = async (patientId: string, status: PatientStatus) => {
    const patientDocRef = doc(patientsCollection, patientId);
    return await updateDoc(patientDocRef, { status });
}

// Update the doctor's total revenue
export const updateDoctorRevenue = async (doctorId: string, amount: number) => {
    const doctorRef = doc(doctorsCollection, doctorId);
    // Use the Firestore 'increment' FieldValue to add to the existing revenue.
    await updateDoc(doctorRef, { totalRevenue: increment(amount) });
}

// Finish a consultation and call the next patient
export const finishAndCallNext = async (currentPatientId: string, nextPatientId: string) => {
    const batch = writeBatch(db);
    
    const finishedPatientRef = doc(patientsCollection, currentPatientId);
    batch.update(finishedPatientRef, { status: 'Finished' });

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
export const updateDoctorMessage = async (message: string) => {
    const statusDocRef = doc(clinicInfoCollection, 'status');
    return await setDoc(statusDocRef, { doctorMessage: message }, { merge: true });
};

// Listen to the doctor's global message
export const listenToDoctorMessage = (callback: (message: string) => void) => {
    const statusDocRef = doc(clinicInfoCollection, 'status');
    const unsubscribe = onSnapshot(statusDocRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data().doctorMessage || "");
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

// Get a doctor's profile
export const getDoctorProfile = async (uid: string): Promise<DoctorProfile | null> => {
    const docRef = doc(doctorsCollection, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as DoctorProfile;
    }
    return null;
}

// Set/Update a doctor's profile
export const setDoctorProfile = async (uid: string, profile: Partial<DoctorProfile>) => {
    const docRef = doc(doctorsCollection, uid);
    return await setDoc(docRef, profile, { merge: true });
}

// Set doctor's availability status
export const setDoctorAvailability = async (uid: string, isAvailable: boolean) => {
    const docRef = doc(doctorsCollection, uid);
    return await setDoc(docRef, { isAvailable }, { merge: true });
};

// Listen to a doctor's availability
export const listenToDoctorAvailability = (callback: (isAvailable: boolean) => void) => {
    // This assumes there's only one doctor for simplicity.
    // In a multi-doctor scenario, you'd need a way to specify which doctor to listen to.
    const q = query(doctorsCollection, limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const doctorData = snapshot.docs[0].data();
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
