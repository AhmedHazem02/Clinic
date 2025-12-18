import * as firebaseAdmin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function loadServiceAccount(): any | null {
  try {
    const jsonPath = path.join(process.cwd(), 'queuewise-clinic-bgafu-firebase-adminsdk-fbsvc-6ff0ffa5bd.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore and fallback
  }
  return null;
}

function buildCertFromEnv(): any | null {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      project_id: FIREBASE_PROJECT_ID,
      client_email: FIREBASE_CLIENT_EMAIL,
      private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as any;
  }
  return null;
}

function initializeFirebaseAdmin() {
  if (firebaseAdmin.apps.length > 0) {
    return firebaseAdmin;
  }

  try {
    const serviceAccount = loadServiceAccount() || buildCertFromEnv();

    if (serviceAccount) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount as any),
      });
    } else {
      // Rely on Application Default Credentials or environment configured credentials
      firebaseAdmin.initializeApp();
    }

    return firebaseAdmin;
  } catch (error: any) {
    throw new Error(`Failed to initialize Firebase Admin: ${error?.message || error}`);
  }
}

export const admin = () => initializeFirebaseAdmin();
export const authAdmin = () => initializeFirebaseAdmin().auth();
export const adminDb = () => initializeFirebaseAdmin().firestore();
export const adminApp = () => initializeFirebaseAdmin().app();
