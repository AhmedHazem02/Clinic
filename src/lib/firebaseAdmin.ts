import * as firebaseAdmin from 'firebase-admin';
import serviceAccount from '../../queuewise-clinic-bgafu-firebase-adminsdk-fbsvc-6ff0ffa5bd.json';

// This function now handles the "just-in-time" initialization of Firebase Admin.
function initializeFirebaseAdmin() {
  if (firebaseAdmin.apps.length > 0) {
    return firebaseAdmin;
  }

  try {
    firebaseAdmin.initializeApp({
      // Use the imported service account object directly
      credential: firebaseAdmin.credential.cert(serviceAccount as any),
    });
    return firebaseAdmin;
  } catch (error: any) {
    throw new Error(
      `Failed to initialize Firebase Admin: ${error.message}`
    );
  }
}

// Export a getter function for the admin instance.
// This ensures initializeFirebaseAdmin() is called only when 'admin' is accessed.
export const admin = () => initializeFirebaseAdmin();

// Export a getter for the auth admin service.
export const authAdmin = () => initializeFirebaseAdmin().auth();
