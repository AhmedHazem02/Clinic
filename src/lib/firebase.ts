
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHUXPQGzzUau7rDmNZBQSGhpnpTj8I28w",
  authDomain: "queuewise-clinic-bgafu.firebaseapp.com",
  projectId: "queuewise-clinic-bgafu",
  storageBucket: "queuewise-clinic-bgafu.appspot.com",
  messagingSenderId: "823213877401",
  appId: "1:823213877401:web:d516081a75bbd9b95db008"
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
