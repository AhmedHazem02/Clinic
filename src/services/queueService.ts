import { db } from "@/lib/firebase";
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    Timestamp,
    onSnapshot,
    orderBy
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
    return today.toISOString().split('T')[0];
}

// Get the queue collection for today
const getTodaysQueueCollection = () => {
    const todayStr = getTodaysDateStr();
    return collection(db, `queues/${todayStr}/patients`);
}

// Get the next queue number for today
const getNextQueueNumber = async (): Promise<number> => {
    const queueCollection = getTodaysQueueCollection();
    const q = query(queueCollection);
    const snapshot = await getDocs(q);
    return snapshot.size + 1;
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
export const listenToTodaysQueue = (callback: (patients: PatientInQueue[]) => void) => {
    const queueCollection = getTodaysQueueCollection();
    const q = query(queueCollection, orderBy("queueNumber"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const patients: PatientInQueue[] = [];
        querySnapshot.forEach((doc) => {
            patients.push({ id: doc.id, ...doc.data() } as PatientInQueue);
        });
        callback(patients);
    });

    return unsubscribe; // Return the unsubscribe function to clean up the listener
}
