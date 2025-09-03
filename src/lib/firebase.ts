// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getPerformance, type Performance } from "firebase/performance";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration - Hardcoded to fix invalid API key issue
const firebaseConfig = {
  apiKey: "AIzaSyCHUXPQGzzUau7rDmNZBQSGhpnpTj8I28w",
  authDomain: "queuewise-clinic-bgafu.firebaseapp.com",
  projectId: "queuewise-clinic-bgafu",
  storageBucket: "queuewise-clinic-bgafu.appspot.com",
  messagingSenderId: "823213877401",
  appId: "1:823213877401:web:d516081a75bbd9b95db008"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db: Firestore = getFirestore(app);

let auth: Auth;
let perf: Performance | undefined;

if (typeof window !== 'undefined') {
  auth = getAuth(app);
  perf = getPerformance(app);
} else {
  // Provide a dummy auth object for the server-side to avoid errors.
  // The actual auth operations should only happen on the client.
  auth = {} as Auth;
}

export { app, db, auth, perf };
