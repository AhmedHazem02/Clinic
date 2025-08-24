import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        console.warn("Firebase Admin SDK not initialized. FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
    }
}

let authAdmin;

if (admin.apps.length > 0) {
    authAdmin = admin.auth();
} else {
    // Provide a dummy object or throw an error to prevent the app from crashing.
    // In this case, we'll log an error and functions using authAdmin will fail gracefully.
    console.error("Firebase Admin has not been initialized. authAdmin will not be available.");
    authAdmin = {
      createUser: () => Promise.reject(new Error("Firebase Admin not initialized.")),
      setCustomUserClaims: () => Promise.reject(new Error("Firebase Admin not initialized.")),
      // Add other methods you use if necessary, all rejecting with an error.
    }
}


export { admin, authAdmin };
