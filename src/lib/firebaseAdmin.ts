import * as admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin;
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase Admin SDK cannot be initialized.'
    );
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin;
  } catch (error: any) {
    throw new Error(
      `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY or initialize Firebase Admin: ${error.message}`
    );
  }
}

const adminInstance = initializeFirebaseAdmin();
const authAdmin = adminInstance.auth();

export { adminInstance as admin, authAdmin };
