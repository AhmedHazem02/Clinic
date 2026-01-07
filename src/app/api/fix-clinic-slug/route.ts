/**
 * Fix Clinic Slug API
 *
 * POST /api/fix-clinic-slug
 *
 * Generates and sets a slug for clinics that don't have one
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Generate slug from clinic name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'clinic';
}

// Check if slug is unique
async function isSlugUnique(slug: string, excludeClinicId?: string): Promise<boolean> {
  const snapshot = await adminDb()
    .collection('clinics')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) return true;

  // If the only match is the clinic we're updating, it's fine
  if (excludeClinicId && snapshot.docs[0].id === excludeClinicId) {
    return true;
  }

  return false;
}

// Generate unique slug by appending number if needed
async function generateUniqueSlug(baseName: string, excludeClinicId?: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;

  while (!(await isSlugUnique(slug, excludeClinicId))) {
    slug = `${generateSlug(baseName)}-${counter}`;
    counter++;
  }

  return slug;
}

export async function POST(request: NextRequest) {
  try {
    const db = adminDb();

    // Get all clinics
    const clinicsSnapshot = await db.collection('clinics').get();

    const updates: Array<{id: string, oldSlug: string, newSlug: string}> = [];

    for (const doc of clinicsSnapshot.docs) {
      const data = doc.data();

      // Check if slug is missing or empty
      if (!data.slug || data.slug.trim() === '') {
        const clinicName = data.name || data.ownerEmail?.split('@')[0] || 'clinic';

        // Generate unique slug
        const newSlug = await generateUniqueSlug(clinicName, doc.id);

        // Update clinic with new slug
        await doc.ref.update({ slug: newSlug });

        updates.push({
          id: doc.id,
          oldSlug: data.slug || '(empty)',
          newSlug: newSlug
        });

        console.log(`✅ Updated clinic "${data.name}" (${doc.id}) with slug: "${newSlug}"`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Fixed ${updates.length} clinic(s)`,
      updates: updates
    });

  } catch (error: any) {
    console.error('Error fixing clinic slugs:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
