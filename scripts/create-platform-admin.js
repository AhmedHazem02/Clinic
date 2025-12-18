/**
 * Script to create a Platform Super Admin
 * 
 * Usage: node scripts/create-platform-admin.js
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase Admin SDK credentials in .env.local');
    console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createPlatformAdmin() {
  const email = 'xfuse@gmail.com';
  const password = 'Admin123';
  const displayName = 'Super Admin';

  try {
    console.log('\n🔐 Creating Platform Super Admin...\n');
    
    // Check if user already exists
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`✅ User already exists with UID: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await auth.createUser({
          email: email,
          password: password,
          displayName: displayName,
          emailVerified: true,
        });
        console.log(`✅ User created with UID: ${user.uid}`);
      } else {
        throw error;
      }
    }

    // Add to platformAdmins collection
    const adminDocRef = db.collection('platformAdmins').doc(user.uid);
    const adminDoc = await adminDocRef.get();

    if (adminDoc.exists) {
      console.log(`ℹ️  Platform admin document already exists`);
      
      // Update to ensure isActive is true
      await adminDocRef.update({
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Updated isActive to true`);
    } else {
      // Create new platform admin document
      await adminDocRef.set({
        uid: user.uid,
        email: email,
        displayName: displayName,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Platform admin document created`);
    }

    console.log('\n✨ Platform Super Admin setup complete!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🆔 UID:', user.uid);
    console.log('\n🌐 You can now login at: /platform/login\n');

  } catch (error) {
    console.error('\n❌ Error creating platform admin:', error.message);
    process.exit(1);
  }
}

// Run the script
createPlatformAdmin()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
