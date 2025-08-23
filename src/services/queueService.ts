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
    writeBatch
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

// Function to get today's date in YYYY-MM-DD format
const getTodaysDateStr = () => {
    const today = new Date();
    // Adjust for timezone to get local date
    const offset = today.getTimezoneOffset();
    const todayLocal = new Date(today.getTime() - (offset*60*1000));
    return todayLocal.toISOString().split('T')[0];
}

// Get the queue collection for today
const getTodaysQueueCollection = () => {
    const todayStr = getTodaysDateStr();
    return collection(db, `queues/${todayStr}/patients`);
}

// Get the next queue number for today
const getNextQueueNumber = async (): Promise<number> => {
    const queueCollection = getTodaysQueueCollection();
    // Query to get the last patient to determine the queue number
    const q = query(queueCollection, orderBy("queueNumber", "desc"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return 1;
    }
    const lastPatient = snapshot.docs[0].data();
    return (lastPatient.queueNumber || 0) + 1;
}

// Add a new patient to today's queue
export const addPatientToQueue = async (patientData: NewPatient) => {
    const queueNumber = await getNextQueueNumber();
    const queueCollection = getTodaysQueueCollection();

    const newPatientDoc = {
        ...patientData,
        queueNumber,
        status: 'Waiting' as PatientStatus,
        createdAt: Timestamp.now(),
    };

    return await addDoc(queueCollection, newPatientDoc);
}

// Listen for real-time updates to today's queue
export const listenToTodaysQueue = (
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const queueCollection = getTodaysQueueCollection();
    const q = query(queueCollection, orderBy("queueNumber"));

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

// Get a patient from today's queue by phone number
export const getPatientByPhone = async (phone: string): Promise<PatientInQueue | null> => {
    const queueCollection = getTodaysQueueCollection();
    const q = query(queueCollection, where("phone", "==", phone), limit(1));
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PatientInQueue;
}


// Update a patient's status
export const updatePatientStatus = async (patientId: string, status: PatientStatus) => {
    const queueCollection = getTodaysQueueCollection();
    const patientDocRef = doc(queueCollection, patientId);
    return await updateDoc(patientDocRef, { status });
}

// Finish a consultation and call the next patient
export const finishAndCallNext = async (finishedPatientId: string, nextPatientId: string) => {
    const queueCollection = getTodaysQueueCollection();
    const batch = writeBatch(db);

    const finishedPatientRef = doc(queueCollection, finishedPatientId);
    batch.update(finishedPatientRef, { status: 'Finished' });

    const nextPatientRef = doc(queueCollection, nextPatientId);
    batch.update(nextPatientRef, { status: 'Consulting' });
    
    await batch.commit();
}
