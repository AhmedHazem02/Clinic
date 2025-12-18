/**
 * Platform Admin API: Platform Clients
 * 
 * GET /api/platform/clients - List all clients
 * POST /api/platform/clients - Create new client
 * 
 * Authorization: Platform Admin only (all operations via Admin SDK)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyPlatformAdmin } from '@/lib/platformAdminAuth';

/**
 * GET /api/platform/clients
 * 
 * Returns list of all platform clients ordered by creation date
 */
export async function GET(request: NextRequest) {
  try {
    // Verify platform admin authorization
    const admin = await verifyPlatformAdmin(request);

    // Fetch all platform clients (limit 100)
    const clientsSnapshot = await adminDb()
      .collection('platformClients')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const clients = clientsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamps to ISO strings for JSON serialization
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      currentPeriodStart: doc.data().currentPeriodStart?.toDate?.()?.toISOString() || null,
      currentPeriodEnd: doc.data().currentPeriodEnd?.toDate?.()?.toISOString() || null,
      canceledAt: doc.data().canceledAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({
      ok: true,
      clients,
    });

  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// Generate unique slug from clinic name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Check if slug is unique
async function isSlugUnique(slug: string): Promise<boolean> {
  const snapshot = await adminDb().collection('clinics').where('slug', '==', slug).limit(1).get();
  return snapshot.empty;
}

// Generate unique slug by appending number if needed
async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;
  
  while (!(await isSlugUnique(slug))) {
    slug = `${generateSlug(baseName)}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * POST /api/platform/clients
 * 
 * Creates a new clinic client with complete setup
 */
export async function POST(request: NextRequest) {
  try {
    // Verify platform admin authorization
    const admin = await verifyPlatformAdmin(request);
    const adminUid = admin.uid;

    // Parse request body
    const body = await request.json();
    const { ownerEmail, clinicName, clinicSlug, plan = 'monthly' } = body;

    // Validate required fields
    if (!ownerEmail || !clinicName) {
      return NextResponse.json(
        { error: 'Missing required fields: ownerEmail, clinicName' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate unique clinic slug
    const finalSlug = clinicSlug && (await isSlugUnique(clinicSlug))
      ? clinicSlug
      : await generateUniqueSlug(clinicName);

    // Step 1: Create or get Firebase Auth user
    let ownerUid: string;
    let isNewUser = false;
    
    try {
      const existingUser = await authAdmin().getUserByEmail(ownerEmail);
      ownerUid = existingUser.uid;
    } catch (error: unknown) {
      // User doesn't exist, create new one
      const newUser = await authAdmin().createUser({
        email: ownerEmail,
        emailVerified: false,
        disabled: false,
      });
      ownerUid = newUser.uid;
      isNewUser = true;
    }

    // Step 2: Create clinic document
    const now = FieldValue.serverTimestamp();
    const clinicRef = adminDb().collection('clinics').doc();
    const clinicId = clinicRef.id;

    const clinicData = {
      name: clinicName,
      slug: finalSlug,
      ownerUid: ownerUid,
      ownerId: ownerUid,
      ownerName: ownerEmail.split('@')[0],
      ownerEmail: ownerEmail,
      isActive: true,
      settings: {
        consultationTime: 15,
        consultationCost: 100,
        reConsultationCost: 50,
        timezone: 'Africa/Cairo',
        language: 'ar',
      },
      phoneNumbers: [],
      locations: [],
      subscriptionTier: plan === 'monthly' ? 'pro' : 'free',
      subscriptionStatus: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await clinicRef.set(clinicData);

    // Step 3: Create doctor document for owner (using ownerUid as doctorId)
    // This ensures sameClinic() rules work immediately after login
    const doctorRef = adminDb().collection('doctors').doc(ownerUid);

    const doctorData = {
      uid: ownerUid,
      userId: ownerUid,
      clinicId: clinicId,
      name: ownerEmail.split('@')[0], // Default name, can be updated in onboarding
      email: ownerEmail,
      specialty: 'عام', // Default specialty, can be updated in onboarding
      isActive: true,
      isAvailable: true,
      totalRevenue: 0,
      permissions: {
        canManageSettings: true,
        canManageStaff: true,
        canViewRevenue: true,
      },
      createdAt: now,
      addedBy: adminUid,
    };

    await doctorRef.set(doctorData);

    // Step 4: Create user profile (owner role) with doctorId = ownerUid
    const userProfileRef = adminDb().collection('userProfiles').doc(ownerUid);

    const userProfileData = {
      uid: ownerUid,
      email: ownerEmail,
      displayName: ownerEmail.split('@')[0], // Default name, can be updated in onboarding
      clinicId: clinicId,
      role: 'owner',
      doctorId: ownerUid, // Same as ownerUid for easy lookup
      isActive: true,
      createdAt: now,
    };

    await userProfileRef.set(userProfileData);

    // Step 5: Create platform client document
    const clientRef = adminDb().collection('platformClients').doc();
    const clientId = clientRef.id;

    // Calculate period (30 days for monthly)
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const clientData = {
      clinicId: clinicId,
      clinicName: clinicName,
      clinicSlug: finalSlug,
      ownerUid: ownerUid,
      ownerEmail: ownerEmail,
      ownerName: ownerEmail.split('@')[0],
      plan: plan,
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: now,
      updatedAt: now,
      createdBy: adminUid,
    };

    await clientRef.set(clientData);

    // Step 6: Generate password reset link
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/login`,
      handleCodeInApp: false,
    };

    const resetLink = await authAdmin().generatePasswordResetLink(ownerEmail, actionCodeSettings);

    // Return success response
    return NextResponse.json({
      ok: true,
      clientId: clientId,
      clinicId: clinicId,
      ownerUid: ownerUid,
      resetLink: resetLink,
      isNewUser: isNewUser,
      message: isNewUser
        ? 'Client created successfully with new owner account'
        : 'Client created successfully with existing owner account',
    });

  } catch (error: unknown) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status }
      );
    }

    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
