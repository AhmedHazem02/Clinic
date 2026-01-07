// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Just-in-time initialization
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

function getFirebase() {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        if (typeof window !== 'undefined') {
            auth = getAuth(app);
        } else {
            // Provide a dummy auth object for the server-side
            auth = {} as Auth; 
        }
    } else {
        app = getApp();
        db = getFirestore(app);
        if (typeof window !== 'undefined') {
            auth = getAuth(app);
        } else {
            auth = {} as Auth;
        }
    }
    return { app, db, auth };
}

// Export the getter function
export { getFirebase };
