/**
 * Migration Script: Add doctorId to nurses without one
 *
 * Run this script once to ensure all nurses have a doctorId assigned
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin with credentials
if (!admin.apps.length) {
  // Try to use FIREBASE_SERVICE_ACCOUNT_KEY from env first
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized with service account key from env');
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local');
    console.log('\nPlease add the following to your .env.local file:');
    console.log('FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
    console.log('\nYou can get this from Firebase Console > Project Settings > Service Accounts > Generate New Private Key');
    process.exit(1);
  }
}

const db = admin.firestore();

async function migrateNurses() {
  try {
    console.log('🔍 Fetching all nurses...');

    const nursesSnapshot = await db.collection('nurses').get();
    console.log(`📊 Found ${nursesSnapshot.size} nurses`);

    let updated = 0;
    let alreadyHaveDoctorId = 0;
    let errors = 0;

    for (const nurseDoc of nursesSnapshot.docs) {
      const nurseData = nurseDoc.data();
      const nurseId = nurseDoc.id;

      // Check if nurse already has doctorId
      if (nurseData.doctorId) {
        console.log(`✅ ${nurseData.name} (${nurseId}) already has doctorId: ${nurseData.doctorId}`);
        alreadyHaveDoctorId++;
        continue;
      }

      console.log(`⚠️  ${nurseData.name} (${nurseId}) is missing doctorId`);

      // Get first active doctor from the same clinic
      if (!nurseData.clinicId) {
        console.log(`   ❌ Nurse has no clinicId, skipping...`);
        errors++;
        continue;
      }

      const doctorsQuery = await db.collection('doctors')
        .where('clinicId', '==', nurseData.clinicId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (doctorsQuery.empty) {
        console.log(`   ❌ No active doctors found in clinic ${nurseData.clinicId}`);
        errors++;
        continue;
      }

      const doctorId = doctorsQuery.docs[0].id;
      const doctorName = doctorsQuery.docs[0].data().name;

      // Update nurse with doctorId
      await nurseDoc.ref.update({ doctorId });
      console.log(`   ✅ Updated ${nurseData.name} -> assigned to Dr. ${doctorName} (${doctorId})`);
      updated++;
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Already had doctorId: ${alreadyHaveDoctorId}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${nursesSnapshot.size}`);

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateNurses()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
