import * as firebaseAdmin from 'firebase-admin';

// This function now handles the "just-in-time" initialization of Firebase Admin.
function initializeFirebaseAdmin() {
  if (firebaseAdmin.apps.length > 0) {
    return firebaseAdmin;
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    // This error will now only be thrown when an admin function is actually called,
    // not when the application starts up.
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase Admin SDK cannot be initialized.'
    );
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
    return firebaseAdmin;
  } catch (error: any) {
    throw new Error(
      `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY or initialize Firebase Admin: ${error.message}`
    );
  }
}

// Export a getter function for the admin instance.
// This ensures initializeFirebaseAdmin() is called only when 'admin' is accessed.
export const admin = () => initializeFirebaseAdmin();

// Export a getter for the auth admin service.
export const authAdmin = () => initializeFirebaseAdmin().auth();
