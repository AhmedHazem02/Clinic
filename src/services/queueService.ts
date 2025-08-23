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
    or
} from "firebase/firestore";

export type PatientStatus = 'Waiting' | 'Consulting' | 'Finished';

export interface NewPatient {
    name: string;
    phone: string;
    age: number | null;
    chronicDiseases: string | null;
}

export interface PatientInQueue extends NewPatient {
    id: string;
    queueNumber: number;
    status: PatientStatus;
    createdAt: Timestamp;
}

// Get the main patients collection
const patientsCollection = collection(db, 'patients');

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
    const existingPatient = await getPatientByPhone(patientData.phone);
    if (existingPatient) {
        throw new Error("A patient with this phone number is already in the queue.");
    }

    const queueNumber = await getNextQueueNumber();

    const newPatientDoc = {
        ...patientData,
        queueNumber,
        status: 'Waiting' as PatientStatus,
        createdAt: Timestamp.now(),
    };

    return await addDoc(patientsCollection, newPatientDoc);
}

// Listen for real-time updates to the queue (waiting and consulting patients)
export const listenToQueue = (
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const q = query(
        patientsCollection, 
        where("status", "in", ["Waiting", "Consulting"]),
        orderBy("queueNumber")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const patients: PatientInQueue[] = [];
        querySnapshot.forEach((doc) => {
            patients.push({ id: doc.id, ...doc.data() } as PatientInQueue);
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

// Get an active patient by phone number
export const getPatientByPhone = async (phone: string): Promise<PatientInQueue | null> => {
    const q = query(
        patientsCollection, 
        where("phone", "==", phone), 
        or(where("status", "==", "Waiting"), where("status", "==", "Consulting")),
        limit(1)
    );
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PatientInQueue;
}


// Update a patient's status
export const updatePatientStatus = async (patientId: string, status: PatientStatus) => {
    const patientDocRef = doc(patientsCollection, patientId);
    return await updateDoc(patientDocRef, { status });
}

// Finish a consultation and call the next patient
export const finishAndCallNext = async (finishedPatientId: string, nextPatientId: string) => {
    const batch = writeBatch(db);

    const finishedPatientRef = doc(patientsCollection, finishedPatientId);
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
