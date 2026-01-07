/**
 * Script to add slug to clinic that doesn't have one
 * Run with: node scripts/add-clinic-slug.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account (same logic as firebaseAdmin.ts)
function loadServiceAccount() {
  try {
    const jsonPath = path.join(process.cwd(), 'queuewise-clinic-bgafu-firebase-adminsdk-fbsvc-6ff0ffa5bd.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading service account:', e);
  }
  return null;
}

const serviceAccount = loadServiceAccount();

if (!serviceAccount) {
  console.error('❌ Service account key not found!');
  console.log('Expected file: queuewise-clinic-bgafu-firebase-adminsdk-fbsvc-6ff0ffa5bd.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addSlugToClinics() {
  try {
    console.log('Starting to add slugs to clinics...');

    const clinicsSnapshot = await db.collection('clinics').get();

    for (const doc of clinicsSnapshot.docs) {
      const data = doc.data();

      // Check if slug is missing or empty
      if (!data.slug || data.slug.trim() === '') {
        const clinicName = data.name || 'clinic';

        // Generate slug from clinic name (Arabic-safe)
        // Convert to lowercase, remove special chars, replace spaces with hyphens
        let slug = clinicName
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')           // Replace spaces with hyphens
          .replace(/[^\u0600-\u06FFa-z0-9\-]/g, '') // Keep Arabic, English, numbers, hyphens
          .replace(/\-+/g, '-')           // Replace multiple hyphens with single
          .replace(/^\-|\-$/g, '');       // Remove leading/trailing hyphens

        // If slug is empty after sanitization, use clinic ID
        if (!slug) {
          slug = doc.id;
        }

        // Check if slug already exists
        const existingSlug = await db.collection('clinics')
          .where('slug', '==', slug)
          .get();

        // If slug exists, append clinic ID
        if (!existingSlug.empty && existingSlug.docs[0].id !== doc.id) {
          slug = `${slug}-${doc.id.substring(0, 6)}`;
        }

        // Update clinic with new slug
        await doc.ref.update({ slug });

        console.log(`✅ Updated clinic "${data.name}" (${doc.id}) with slug: "${slug}"`);
      } else {
        console.log(`⏭️  Clinic "${data.name}" (${doc.id}) already has slug: "${data.slug}"`);
      }
    }

    console.log('\n✨ Done! All clinics now have slugs.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addSlugToClinics();
