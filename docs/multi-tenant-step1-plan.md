# Multi-Tenant Clinic Account Migration Plan - Step 1

**Project:** QueueWise Clinic System
**Goal:** Evolve the application into a multi-tenant SaaS model where each clinic account has an owner/admin who can manage multiple doctors and nurses
**Date:** December 18, 2025
**Status:** Planning Phase - Awaiting Approval

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Proposed Multi-Tenant Data Model](#proposed-multi-tenant-data-model)
4. [Authentication & Authorization Strategy](#authentication--authorization-strategy)
5. [Required UI Changes](#required-ui-changes)
6. [Migration Strategy](#migration-strategy)
7. [Firestore Security Rules Impact](#firestore-security-rules-impact)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Risk Assessment](#risk-assessment)
10. [Open Questions](#open-questions)

---

## Executive Summary

### Business Requirements

The QueueWise Clinic system needs to transition from a **single-doctor/clinic model** to a **multi-tenant SaaS platform** with the following capabilities:

1. **Clinic Ownership:** Each clinic is sold to a doctor/clinic owner who becomes the admin
2. **Staff Management:** Owners can add/manage nurses and additional doctors under their clinic account
3. **Patient Booking:** Patients can self-book appointments and must select a specific doctor within the clinic
4. **Data Isolation:** Complete separation of data between different clinic accounts
5. **Feature Preservation:** Maintain all existing features (queue management, QR codes, patient status, prescriptions, etc.)

### Current State

The application currently operates as a **single-clinic system** where:
- Each doctor effectively IS a clinic (doctorId is used as the primary data filter)
- Doctors and nurses share the same Firebase authentication UID
- No explicit clinic/tenant concept exists
- Patient data is scoped by `doctorId` only
- Public patient search works globally across all doctors

### Proposed Approach

Introduce a **clinic-first architecture** with minimal disruption:
- Add a new `clinics` collection as the top-level tenant container
- Restructure `doctors` and `nurses` to belong to clinics
- Add `clinicId` to all patient/queue/appointment data
- Implement a `userProfiles` collection to map Firebase auth UID → clinicId + role
- Preserve existing UI patterns and features with targeted modifications

---

## Current Architecture Analysis

### Technology Stack

- **Framework:** Next.js 15.3.8 (App Router)
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth (Client + Admin SDK)
- **UI:** React, Tailwind CSS, shadcn/ui
- **AI Integration:** Genkit AI for prescription assistance
- **Language:** TypeScript, Arabic RTL interface

### Directory Structure

```
src/
├── app/                           # Next.js App Router pages
│   ├── doctor/                   # Doctor-specific routes
│   │   ├── dashboard/           # Main doctor dashboard
│   │   ├── history/             # Patient history
│   │   ├── onboarding/          # First-time setup
│   │   ├── profile/             # Edit doctor profile
│   │   └── settings/            # Clinic settings
│   ├── nurse/                    # Nurse-specific routes
│   │   ├── dashboard/           # Nurse dashboard & patient registration
│   │   └── profile/             # Edit nurse profile
│   ├── status/[doctorId]/[phone]/  # Public patient status page
│   ├── login/                    # Staff login
│   ├── page.tsx                  # Public home page (patient search)
│   └── actions.ts                # Server actions
├── components/
│   ├── doctor/                   # Doctor-specific components
│   ├── nurse/                    # Nurse-specific components
│   └── ui/                       # Reusable UI components (shadcn)
├── services/
│   ├── authService.ts           # Server-side auth (Admin SDK)
│   ├── authClientService.ts     # Client-side auth
│   ├── queueService.ts          # Client-side queue operations
│   └── queueService.admin.ts    # Server-side queue operations
├── lib/
│   ├── firebase.ts              # Firebase client config
│   └── firebaseAdmin.ts         # Firebase Admin config
└── ai/
    └── flows/                    # AI-assisted prescription flows
```

### Current Authentication Flow

**File:** [src/services/authService.ts](../src/services/authService.ts)

```typescript
export const createUser = async (email: string, password: string, role: 'doctor' | 'nurse') => {
    const userRecord = await authAdmin().createUser({
        email,
        password,
        displayName: role.charAt(0).toUpperCase() + role.slice(1),
    });
    // Set custom claims for role
    await authAdmin().setCustomUserClaims(userRecord.uid, { role });
    return userRecord;
}
```

**Key Findings:**
- Roles are stored as Firebase custom claims (`doctor` or `nurse`)
- **Critical Issue:** Doctors and nurses currently share the same UID (same user account)
- No `clinicId` is assigned during user creation
- Login flow uses tab selection (doctor vs nurse) to redirect, not actual role verification

**Auth Contexts:**

1. **Doctor Context:** [src/components/doctor/doctor-profile-provider.tsx](../src/components/doctor/doctor-profile-provider.tsx)
   - Wraps all doctor routes
   - Fetches doctor profile from `doctors/{uid}` collection
   - Redirects to onboarding if no profile exists

2. **Nurse Context:** [src/components/nurse/nurse-profile-provider.tsx](../src/components/nurse/nurse-profile-provider.tsx)
   - Wraps all nurse routes
   - Creates temporary profile if not found in `nurses/{uid}` collection

### Current Firestore Collections

#### 1. `patients` Collection

**Purpose:** Stores all patient records and queue entries
**Document ID:** Auto-generated
**Indexed Fields:** `doctorId`, `phone`, `status`, `createdAt`, `bookingDate`

**Schema:**
```typescript
{
  name: string;                    // Patient name
  phone: string;                   // 11-digit phone number (primary identifier)
  age: number | null;              // Optional age
  chronicDiseases: string | null;  // Optional chronic conditions
  consultationReason: string | null; // Reason for visit
  queueNumber: number;             // Daily queue number (per doctor)
  status: 'Waiting' | 'Consulting' | 'Finished';
  queueType: 'Consultation' | 'Re-consultation';
  bookingDate: Timestamp;          // Appointment date
  createdAt: Timestamp;            // Registration timestamp
  doctorId: string;                // ❗ Firebase auth UID (critical filter)
  nurseId: string;                 // Firebase auth UID of registering nurse
  nurseName: string;               // Name of registering nurse
  prescription: string;            // Doctor's prescription text
}
```

**Critical Dependencies:**
- All queries filter by `doctorId` (see lines 78-84, 117-123 in [queueService.ts](../src/services/queueService.ts:78-84))
- Queue number generation is scoped per `doctorId` per day
- Patient search on home page uses `getPatientByPhoneAcrossClinics()` which searches across all doctors

#### 2. `doctors` Collection

**Purpose:** Doctor profiles
**Document ID:** Firebase auth UID
**Schema:**
```typescript
{
  name: string;                    // Doctor name
  specialty: string;               // Medical specialty
  clinicPhoneNumbers: string[];    // Array of contact numbers
  locations: string[];             // Array of clinic locations
  avatarUrl?: string;              // Profile image URL
  isAvailable?: boolean;           // Current availability status
  totalRevenue?: number;           // Accumulated revenue
}
```

**Critical Issue:** No `clinicId` field - each doctor is treated as an independent clinic

#### 3. `nurses` Collection

**Purpose:** Nurse profiles
**Document ID:** Firebase auth UID
**Schema:**
```typescript
{
  name: string;                    // Nurse name
  email: string;                   // Email address
  avatarUrl?: string;              // Profile image URL
}
```

**Critical Issue:** No `clinicId` or `doctorId` field - nurses cannot be linked to clinics or doctors

#### 4. `clinicInfo` Collection

**Purpose:** Global clinic settings (document-based, not collection)
**Documents:**

1. **`settings` document:**
```typescript
{
  consultationTime: number;        // Minutes per consultation
  consultationCost: number;        // Price for new consultation
  reConsultationCost: number;      // Price for re-consultation
}
```

2. **`status` document:**
```typescript
{
  message_{doctorId}: string;      // Per-doctor message to patients
  // Example: "message_abc123": "سأتأخر 30 دقيقة"
}
```

**Critical Issue:** Settings are global, not per-clinic or per-doctor. Messages use a dynamic field pattern that won't scale.

### Current Data Flow

#### Patient Registration Flow

**File:** [src/components/nurse/patient-registration-form.tsx](../src/components/nurse/patient-registration-form.tsx:94-106)

```typescript
// Line 94-106
await addPatientToQueue({
  name: values.name,
  doctorId: user.uid,  // ❗ Nurse's UID used as doctorId
  phone: values.phone,
  bookingDate: values.bookingDate,
  age: values.age || null,
  chronicDiseases: values.diseases || null,
  consultationReason: values.consultationReason || null,
  queueType: values.queueType as QueueType,
  nurseId: user.uid,   // ❗ Same UID
  nurseName: profile.name,
});
```

**Critical Finding:** Both `doctorId` and `nurseId` are set to `user.uid` because doctors and nurses share the same authentication account.

#### Patient Status Page Flow

**File:** [src/app/status/[doctorId]/[phone]/page.tsx](../src/app/status/[doctorId]/[phone]/page.tsx)

**Route:** `/status/{doctorId}/{phone}`
**Access:** Public (no authentication required)
**Purpose:** Patients can view their queue position and status

**Data Flow:**
1. Extract `doctorId` and `phone` from URL params
2. Listen to queue for that specific doctor (`listenToQueue(doctorId, ...)`)
3. Find patient by phone number where `status !== 'Finished'`
4. Calculate people ahead in the same queue type
5. Display real-time updates

**Critical Dependencies:**
- Patient search on home page uses `getPatientByPhoneAcrossClinics()` which finds active patients globally
- Redirects to `/status/{doctorId}/{phone}` after finding patient
- **Risk:** In multi-tenant, patients need to choose clinic+doctor, not just doctor

#### Queue Management

**File:** [src/services/queueService.ts](../src/services/queueService.ts)

**Key Functions:**
- `getNextQueueNumber(doctorId)` - Generate daily queue numbers per doctor (lines 71-91)
- `addPatientToQueue(patientData)` - Add patient with validation (lines 109-156)
- `listenToQueue(doctorId, callback)` - Real-time queue listener (lines 159-206)
- `updatePatientStatus(patientId, status, prescription?)` - Status updates (lines 318-326)
- `finishAndCallNext(currentPatientId, nextPatientId, prescription?)` - Batch status update (lines 337-352)

**Critical Queries:**
```typescript
// Queue number generation (lines 78-84)
query(
  patientsCollection,
  where("doctorId", "==", doctorId),
  where("createdAt", ">=", startOfToday),
  orderBy("createdAt", "desc"),
  limit(1)
)

// Queue listening (lines 166-170)
query(
  patientsCollection,
  where("doctorId", "==", doctorId),
  orderBy("queueNumber")
)
```

**Multi-Tenant Impact:** Need to add `clinicId` to all queries for data isolation.

### Missing Features & Build Issues

Based on codebase analysis:

1. ✅ **Doctor Dashboard** - Exists at `/doctor/dashboard`
2. ✅ **Nurse Dashboard** - Exists at `/nurse/dashboard`
3. ✅ **Queue Management** - Real-time queue display and updates
4. ✅ **QR Code Generation** - Nurses can generate QR codes for patients
5. ✅ **Patient Status Page** - Public page at `/status/[doctorId]/[phone]`
6. ✅ **Patient Search** - Home page with phone search
7. ✅ **Prescription Management** - Doctor can write/save prescriptions
8. ✅ **AI-Assisted Prescriptions** - Genkit AI integration
9. ✅ **Revenue Tracking** - Daily revenue calculation
10. ❌ **User Registration UI** - No self-service registration for staff (currently done manually via auth service)
11. ❌ **Clinic Owner Dashboard** - No admin interface for managing clinic
12. ❌ **Staff Invitation System** - No way to invite nurses/doctors to join a clinic

### Current Limitations for Multi-Tenancy

1. **No Clinic Entity:** Doctor IS the clinic - no separation
2. **Shared UID for Doctor/Nurse:** Same user acts as both roles
3. **No Staff Hierarchy:** No concept of clinic owner who manages staff
4. **Global Settings:** Clinic settings are system-wide, not per-clinic
5. **Global Patient Search:** Patients can search across all doctors (no clinic context)
6. **No Invitations:** No way to invite and onboard staff to a clinic account
7. **Direct Auth Access:** All queries use Firebase auth UID directly, not a profile mapping

---

## Proposed Multi-Tenant Data Model

### Design Principles

1. **Clinic-First Architecture:** All data scoped by `clinicId` first, then `doctorId`
2. **Profile Mapping Layer:** Separate Firebase auth UID from business roles using `userProfiles`
3. **Preserve Existing UX:** Minimal changes to current doctor/nurse workflows
4. **Data Isolation:** Firestore rules enforce strict clinic-level separation
5. **Scalability:** Support 100s of clinics, each with multiple doctors and nurses

### New Collection: `clinics`

**Purpose:** Top-level tenant container
**Document ID:** Auto-generated
**Schema:**

```typescript
{
  // Basic Info
  name: string;                     // "عيادة د. أحمد العلي"
  subdomain?: string;               // Optional: "dr-ali" for dr-ali.queuewise.com
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Owner Info
  ownerId: string;                  // Firebase auth UID of clinic owner
  ownerName: string;                // "د. أحمد العلي"
  ownerEmail: string;               // Owner's email

  // Subscription Info (for future SaaS features)
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: 'active' | 'suspended' | 'cancelled';
  subscriptionExpiresAt?: Timestamp;

  // Settings (moved from global clinicInfo)
  settings: {
    consultationTime: number;       // Minutes per consultation
    consultationCost: number;       // Price for consultation
    reConsultationCost: number;     // Price for re-consultation
    timezone: string;               // "Africa/Cairo"
    language: string;               // "ar"
  };

  // Contact Info
  phoneNumbers: string[];           // Primary clinic contact numbers
  locations: string[];              // Physical locations

  // Branding (optional)
  logoUrl?: string;
  primaryColor?: string;

  // Statistics (optional)
  stats?: {
    totalDoctors: number;
    totalNurses: number;
    totalPatients: number;
    totalRevenue: number;
  };
}
```

**Example Document:**
```json
{
  "id": "clinic_abc123",
  "name": "عيادة الدكتور أحمد العلي للعظام",
  "ownerId": "user_xyz789",
  "ownerName": "د. أحمد العلي",
  "ownerEmail": "dr.ali@example.com",
  "createdAt": "2025-12-18T10:00:00Z",
  "settings": {
    "consultationTime": 15,
    "consultationCost": 200,
    "reConsultationCost": 100,
    "timezone": "Africa/Cairo",
    "language": "ar"
  },
  "phoneNumbers": ["01234567890", "01098765432"],
  "locations": ["القاهرة - مدينة نصر", "الجيزة - المهندسين"],
  "subscriptionTier": "pro",
  "subscriptionStatus": "active"
}
```

### Restructured Collection: `doctors`

**Purpose:** Doctor profiles within clinics
**Document ID:** Auto-generated (NOT Firebase auth UID)
**Indexed Fields:** `clinicId`, `userId`, `isActive`

**Schema:**

```typescript
{
  // Identity
  userId: string;                   // Firebase auth UID
  clinicId: string;                 // ❗ Parent clinic ID

  // Profile Info
  name: string;                     // "د. محمد حسن"
  email: string;                    // "dr.hassan@example.com"
  specialty: string;                // "طب العظام"
  avatarUrl?: string;

  // Doctor-Specific Settings
  personalPhoneNumbers?: string[];  // Doctor's direct line (optional)
  consultationLocations?: string[]; // If doctor works at specific locations only

  // Status
  isActive: boolean;                // Can be deactivated by owner
  isAvailable: boolean;             // Current availability (toggleable by doctor)

  // Permissions (optional, for fine-grained control)
  permissions?: {
    canManageSettings: boolean;     // Can edit clinic settings
    canManageStaff: boolean;        // Can invite/remove staff
    canViewRevenue: boolean;        // Can view financial data
  };

  // Statistics
  totalRevenue: number;             // Doctor's accumulated revenue

  // Timestamps
  createdAt: Timestamp;
  addedBy: string;                  // UID of user who added this doctor
}
```

**Example Document:**
```json
{
  "id": "doctor_def456",
  "userId": "user_xyz789",
  "clinicId": "clinic_abc123",
  "name": "د. أحمد العلي",
  "email": "dr.ali@example.com",
  "specialty": "طب العظام",
  "isActive": true,
  "isAvailable": true,
  "totalRevenue": 15000,
  "permissions": {
    "canManageSettings": true,
    "canManageStaff": true,
    "canViewRevenue": true
  },
  "createdAt": "2025-12-18T10:00:00Z",
  "addedBy": "user_xyz789"
}
```

**Migration Note:** Current `doctors` collection uses UID as document ID. We'll need to:
1. Create new doctor documents with auto-generated IDs
2. Link them via `userId` field
3. Preserve existing data (name, specialty, etc.)

### Restructured Collection: `nurses`

**Purpose:** Nurse profiles within clinics
**Document ID:** Auto-generated (NOT Firebase auth UID)
**Indexed Fields:** `clinicId`, `userId`, `isActive`

**Schema:**

```typescript
{
  // Identity
  userId: string;                   // Firebase auth UID
  clinicId: string;                 // ❗ Parent clinic ID
  assignedDoctorIds?: string[];     // Optional: Specific doctors this nurse works with

  // Profile Info
  name: string;                     // "فاطمة أحمد"
  email: string;                    // "nurse.fatima@example.com"
  avatarUrl?: string;

  // Status
  isActive: boolean;                // Can be deactivated by owner

  // Timestamps
  createdAt: Timestamp;
  addedBy: string;                  // UID of user who added this nurse
}
```

**Example Document:**
```json
{
  "id": "nurse_ghi789",
  "userId": "user_abc456",
  "clinicId": "clinic_abc123",
  "name": "فاطمة أحمد",
  "email": "nurse.fatima@example.com",
  "isActive": true,
  "assignedDoctorIds": ["doctor_def456"],
  "createdAt": "2025-12-18T11:00:00Z",
  "addedBy": "user_xyz789"
}
```

### New Collection: `userProfiles`

**Purpose:** Map Firebase auth UID → clinicId + role (single source of truth)
**Document ID:** Firebase auth UID
**Critical:** This is the **first lookup** after authentication

**Schema:**

```typescript
{
  // Identity
  uid: string;                      // Firebase auth UID (same as doc ID)
  email: string;                    // User's email
  displayName: string;              // User's display name

  // Clinic Association
  clinicId: string;                 // ❗ Primary clinic ID
  role: 'owner' | 'doctor' | 'nurse'; // ❗ User's role

  // Role-Specific IDs
  doctorId?: string;                // If role=doctor, reference to doctors/{doctorId}
  nurseId?: string;                 // If role=nurse, reference to nurses/{nurseId}

  // Status
  isActive: boolean;                // Can be deactivated by owner

  // Timestamps
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;

  // Invitation Tracking (optional)
  invitedBy?: string;               // UID of user who invited
  invitedAt?: Timestamp;
  acceptedAt?: Timestamp;
}
```

**Example Documents:**

```json
// Clinic Owner (who is also the main doctor)
{
  "uid": "user_xyz789",
  "email": "dr.ali@example.com",
  "displayName": "د. أحمد العلي",
  "clinicId": "clinic_abc123",
  "role": "owner",
  "doctorId": "doctor_def456",
  "isActive": true,
  "createdAt": "2025-12-18T10:00:00Z"
}

// Nurse
{
  "uid": "user_abc456",
  "email": "nurse.fatima@example.com",
  "displayName": "فاطمة أحمد",
  "clinicId": "clinic_abc123",
  "role": "nurse",
  "nurseId": "nurse_ghi789",
  "isActive": true,
  "invitedBy": "user_xyz789",
  "invitedAt": "2025-12-18T11:00:00Z",
  "acceptedAt": "2025-12-18T11:15:00Z",
  "createdAt": "2025-12-18T11:15:00Z"
}

// Additional Doctor
{
  "uid": "user_def789",
  "email": "dr.hassan@example.com",
  "displayName": "د. محمد حسن",
  "clinicId": "clinic_abc123",
  "role": "doctor",
  "doctorId": "doctor_jkl012",
  "isActive": true,
  "invitedBy": "user_xyz789",
  "invitedAt": "2025-12-18T12:00:00Z",
  "acceptedAt": "2025-12-18T12:30:00Z",
  "createdAt": "2025-12-18T12:30:00Z"
}
```

**Authentication Flow:**
1. User signs in → Get Firebase auth UID
2. Fetch `userProfiles/{uid}` → Get `clinicId`, `role`, `doctorId`/`nurseId`
3. Use `clinicId` for all subsequent queries
4. If role = owner → Full clinic management access
5. If role = doctor → Access to own patients only (within clinic)
6. If role = nurse → Access to register patients for assigned doctors

### Updated Collection: `patients`

**Purpose:** Patient records and queue entries (scoped by clinic + doctor)
**Document ID:** Auto-generated
**Indexed Fields:** `clinicId`, `doctorId`, `phone`, `status`, `createdAt`, `bookingDate`

**Updated Schema:**

```typescript
{
  // ❗ New Fields
  clinicId: string;                 // Parent clinic ID
  doctorId: string;                 // doctor document ID (not auth UID!)
  nurseId: string;                  // nurse document ID (not auth UID!)

  // Existing Fields (unchanged)
  name: string;
  phone: string;
  age: number | null;
  chronicDiseases: string | null;
  consultationReason: string | null;
  queueNumber: number;
  status: 'Waiting' | 'Consulting' | 'Finished';
  queueType: 'Consultation' | 'Re-consultation';
  bookingDate: Timestamp;
  createdAt: Timestamp;
  nurseName: string;
  prescription: string;
}
```

**Migration Impact:**
- Existing `patients` documents have `doctorId` = Firebase auth UID
- After migration, `doctorId` will reference `doctors/{doctorId}` document ID
- Need to add `clinicId` to all existing patients

### New Collection: `invitations` (Optional - for Step 2+)

**Purpose:** Invite staff to join clinic
**Document ID:** Auto-generated
**Schema:**

```typescript
{
  clinicId: string;
  email: string;                    // Invited user's email
  role: 'doctor' | 'nurse';
  invitedBy: string;                // UID of inviter
  invitedAt: Timestamp;
  expiresAt: Timestamp;             // 7-day expiry
  status: 'pending' | 'accepted' | 'expired';
  acceptedAt?: Timestamp;
  token: string;                    // Secure invitation token
}
```

**Flow:**
1. Owner sends invitation with email + role
2. System creates invitation document with secure token
3. Email sent to user with invitation link: `/invite?token=abc123`
4. User signs up or logs in
5. System validates token, creates `userProfiles` entry, links to clinic
6. Mark invitation as accepted

---

## Authentication & Authorization Strategy

### Role Model

| Role | Description | Permissions |
|------|-------------|-------------|
| **owner** | Clinic owner/admin | Full clinic management: invite/remove staff, edit settings, view all data, manage subscription |
| **doctor** | Doctor employed by clinic | View own patients, write prescriptions, manage availability, view own revenue |
| **nurse** | Nurse employed by clinic | Register patients, view queue, generate QR codes |
| **patient** | Public (anonymous) | View own status via phone number (no auth required) |

### Enforcement Strategy: Hybrid Approach

**Recommended:** Firestore `userProfiles` collection + Firestore Security Rules

**Why not Firebase Custom Claims?**
- Custom claims have size limits (1000 bytes)
- Require token refresh after updates (poor UX)
- Hard to query (can't find all users in a clinic)
- No support for multiple roles or complex permissions

**Why Firestore userProfiles?**
- Flexible schema for role metadata
- Queryable (find all staff in clinic)
- Real-time updates without token refresh
- Supports fine-grained permissions
- Can store additional profile data

**Implementation Pattern:**

```typescript
// After Firebase Auth sign-in
const user = await signInUser(email, password);

// Fetch user profile (includes clinicId, role, doctorId, nurseId)
const profileRef = doc(db, 'userProfiles', user.uid);
const profileSnap = await getDoc(profileRef);

if (!profileSnap.exists()) {
  // User not yet onboarded → redirect to invitation acceptance or clinic creation
  router.push('/onboarding');
  return;
}

const profile = profileSnap.data();

// Store in context
setUserProfile({
  uid: user.uid,
  clinicId: profile.clinicId,
  role: profile.role,
  doctorId: profile.doctorId,
  nurseId: profile.nurseId,
  isActive: profile.isActive,
});

// Route based on role
if (profile.role === 'owner') {
  router.push('/admin/dashboard');
} else if (profile.role === 'doctor') {
  router.push('/doctor/dashboard');
} else if (profile.role === 'nurse') {
  router.push('/nurse/dashboard');
}
```

### Custom Claims Usage (Optional)

We can still use custom claims for **quick role checks** without Firestore reads:

```typescript
// Set during user creation
await authAdmin().setCustomUserClaims(user.uid, {
  role: 'doctor',
  clinicId: 'clinic_abc123' // Optional, for quick checks
});
```

**Use cases:**
- Server-side API route authorization
- Quick role checks in middleware
- Not a replacement for `userProfiles` (still need full profile data)

### Authorization Checks in Code

**Example: Doctor Dashboard**

```typescript
// src/components/doctor/doctor-profile-provider.tsx (updated)
export function DoctorProfileProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Get user profile
      const profile = await getUserProfile(user.uid);
      if (!profile || profile.role !== 'doctor') {
        router.push('/login');
        return;
      }

      setUserProfile(profile);

      // 2. Get doctor profile
      if (profile.doctorId) {
        const doctor = await getDoctorProfile(profile.doctorId);
        setDoctorProfile(doctor);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, [router]);

  // Provide both userProfile (auth + clinic info) and doctorProfile (doctor-specific data)
  return (
    <DoctorProfileContext.Provider value={{ userProfile, doctorProfile, isLoading }}>
      {children}
    </DoctorProfileContext.Provider>
  );
}
```

**Example: Queue Service Query**

```typescript
// src/services/queueService.ts (updated)
export const listenToQueue = (
    clinicId: string,    // ❗ New parameter
    doctorId: string,
    callback: (patients: PatientInQueue[]) => void,
    errorCallback?: (error: Error) => void
) => {
    const { db } = getFirebase();
    const patientsCollection = collection(db, 'patients');
    const q = query(
        patientsCollection,
        where("clinicId", "==", clinicId),  // ❗ Add clinic filter
        where("doctorId", "==", doctorId),
        orderBy("queueNumber")
    );
    // ... rest of implementation
}
```

### Owner-Specific Permissions

**Clinic Owner Dashboard (New):**
- Route: `/admin/dashboard`
- Features:
  - View all doctors and nurses in clinic
  - Invite new staff (send email invitations)
  - Deactivate/reactivate staff
  - Edit clinic settings (consultation time, costs)
  - View clinic-wide statistics (total revenue, total patients)
  - Manage subscription (future)

**Authorization Check:**

```typescript
// src/app/admin/layout.tsx (new file)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userProfile, isLoading } = useUserProfile();

  if (isLoading) return <LoadingSpinner />;

  if (!userProfile || userProfile.role !== 'owner') {
    redirect('/login');
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

---

## Required UI Changes

### Minimal Changes Philosophy

**Goal:** Preserve 95% of existing UI and workflows. Only modify where multi-tenancy is essential.

### 1. Authentication & Onboarding

#### Changes to Login Flow

**File:** [src/components/login-tabs.tsx](../src/components/login-tabs.tsx)

**Current Behavior:**
- Tab selection determines redirect (doctor vs nurse)
- Same credentials can log in as doctor or nurse

**Proposed Change:**
- After sign-in, fetch `userProfiles/{uid}` to get role
- Redirect based on actual role:
  - `owner` → `/admin/dashboard`
  - `doctor` → `/doctor/dashboard`
  - `nurse` → `/nurse/dashboard`
- Remove tab selection (role is determined by profile)

**UI Impact:** Minor - simplify to single login form

#### New Owner Onboarding Flow

**Route:** `/onboarding/clinic` (new)
**Triggered When:** User signs up for the first time (no `userProfiles` entry)
**Steps:**
1. Collect clinic info: name, contact, locations
2. Collect doctor profile: name, specialty
3. Set clinic settings: consultation time, costs
4. Create:
   - `clinics` document
   - `doctors` document
   - `userProfiles` document with role=owner
5. Redirect to `/admin/dashboard`

**UI Pattern:** Multi-step form (similar to existing doctor onboarding)

#### Staff Invitation Acceptance

**Route:** `/invite?token={token}` (new)
**Flow:**
1. User clicks invitation link in email
2. System validates token and shows clinic name
3. User signs up or logs in
4. System creates `userProfiles` entry and links to clinic
5. Redirect to role-specific dashboard

### 2. Doctor Dashboard

**File:** [src/app/doctor/dashboard/page.tsx](../src/app/doctor/dashboard/page.tsx)

**Current Behavior:**
- Shows current patient, queue, prescriptions
- Filtered by `user.uid` (doctor's Firebase auth UID)

**Proposed Changes:**

✅ **Keep:** Entire UI layout and components
🔄 **Modify:** Data fetching logic

```typescript
// Before
const { user, profile } = useDoctorProfile();
listenToQueue(user.uid, callback);

// After
const { userProfile, doctorProfile } = useDoctorProfile();
listenToQueue(userProfile.clinicId, userProfile.doctorId, callback);
```

**UI Impact:** None (internal change only)

### 3. Nurse Dashboard

**File:** [src/app/nurse/dashboard/page.tsx](../src/app/nurse/dashboard/page.tsx)

**Current Behavior:**
- Patient registration form
- Real-time queue display
- Filtered by `user.uid` (nurse's Firebase auth UID used as doctorId)

**Proposed Changes:**

✅ **Keep:** Entire UI layout and components
🔄 **Modify:**
- Patient registration: Show doctor selection dropdown if clinic has multiple doctors
- Data fetching: Use `clinicId` and `doctorId` from user profile

**New UI Element:**

```tsx
// If clinic has multiple doctors
<FormField
  control={form.control}
  name="doctorId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>الطبيب</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <SelectTrigger>
          <SelectValue placeholder="اختر الطبيب" />
        </SelectTrigger>
        <SelectContent>
          {clinicDoctors.map(doctor => (
            <SelectItem key={doctor.id} value={doctor.id}>
              {doctor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**UI Impact:** Minor - add doctor selection if multiple doctors exist

### 4. Patient Status Page (Public)

**File:** [src/app/status/[doctorId]/[phone]/page.tsx](../src/app/status/[doctorId]/[phone]/page.tsx)

**Current Behavior:**
- Public route: `/status/{doctorId}/{phone}`
- No authentication required

**Proposed Changes:**

**Option A (Recommended):** Keep URL structure, update internal logic
- URL stays: `/status/{doctorId}/{phone}`
- `doctorId` now refers to doctor document ID, not Firebase auth UID
- Internally fetch doctor's clinic and filter by `clinicId` + `doctorId`

**Option B:** Add clinic to URL
- URL becomes: `/status/{clinicId}/{doctorId}/{phone}`
- More explicit, but breaks existing QR codes

**Recommendation:** Use Option A to preserve existing QR codes and bookmarks

**UI Impact:** None (internal change only)

### 5. Home Page (Patient Search)

**File:** [src/app/page.tsx](../src/app/page.tsx)

**Current Behavior:**
- Patient enters phone number
- Search across ALL doctors
- Redirect to `/status/{doctorId}/{phone}`

**Proposed Changes:**

**Option A (Simple):** Keep current behavior
- Search across all clinics and doctors
- If patient found, redirect to their status page
- **Risk:** Patient books with multiple clinics → show disambiguation page

**Option B (Clinic-First):**
- Add clinic selection before phone search
- User selects clinic from dropdown or enters clinic code
- Then enters phone number
- **UX Impact:** Extra step for patients

**Recommendation:** Start with Option A (no change), add disambiguation page if needed

**Disambiguation Page (if patient in multiple clinics):**

```tsx
// /search-results?phone=01234567890
<div>
  <h2>وجدنا عدة نتائج لهذا الرقم</h2>
  <p>يرجى اختيار العيادة:</p>
  <div>
    {results.map(result => (
      <Card key={result.clinicId}>
        <CardHeader>
          <CardTitle>{result.clinicName}</CardTitle>
          <CardDescription>د. {result.doctorName}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => router.push(`/status/${result.doctorId}/${phone}`)}>
            عرض الحالة
          </Button>
        </CardFooter>
      </Card>
    ))}
  </div>
</div>
```

**UI Impact:** Minor - only if patient is in multiple clinics (rare case)

### 6. New Admin Dashboard (Clinic Owner)

**Route:** `/admin/dashboard` (new)

**Features:**
- **Staff Management:**
  - List all doctors and nurses
  - Invite new staff (send email)
  - Deactivate/reactivate staff
  - View staff activity logs
- **Clinic Settings:**
  - Edit clinic info (name, contacts, locations)
  - Edit consultation time and costs
  - Upload logo
- **Statistics:**
  - Total patients served
  - Total revenue
  - Per-doctor statistics
  - Daily/weekly/monthly reports
- **Subscription Management (future):**
  - View current plan
  - Upgrade/downgrade

**UI Pattern:** Similar to doctor dashboard with tabs/sections

### 7. Settings Page

**File:** [src/app/doctor/settings/page.tsx](../src/app/doctor/settings/page.tsx)

**Current Behavior:**
- Doctor can edit global clinic settings (time, costs)

**Proposed Changes:**

**Option A (Recommended):** Owner-only settings
- Move settings to `/admin/settings`
- Only clinic owner can edit
- Doctors see read-only view

**Option B:** Keep doctor access with permissions
- Check if doctor has `canManageSettings` permission
- If yes, allow editing
- If no, show read-only view

**Recommendation:** Option A for simplicity

**UI Impact:** Minor - show message if doctor tries to access settings: "فقط صاحب العيادة يمكنه تعديل الإعدادات"

### 8. QR Code Generation

**File:** Nurse dashboard QR generation component

**Current Behavior:**
- QR code points to: `{baseUrl}/status/{doctorId}/{phone}`

**Proposed Changes:**
- Keep same URL structure (doctorId is now doctor document ID)
- Ensure doctorId in QR is the new doctor document ID, not auth UID

**Migration Note:** Old QR codes (with auth UID) will break. Need to handle gracefully:

```typescript
// In status page
const patient = await getPatientByDoctorIdAndPhone(doctorId, phone);
if (!patient) {
  // Try to find by old system (auth UID)
  const legacyPatient = await getPatientByLegacyDoctorId(doctorId, phone);
  if (legacyPatient) {
    // Redirect to new URL
    router.push(`/status/${legacyPatient.newDoctorId}/${phone}`);
    return;
  }
}
```

**UI Impact:** None for new QR codes. Old QR codes show migration message.

### Summary of UI Changes

| Component | Change Type | Impact Level | User-Facing Changes |
|-----------|-------------|--------------|---------------------|
| Login Page | Moderate | Low | Remove tabs, single form |
| Owner Onboarding | New | N/A | New multi-step form |
| Doctor Dashboard | Internal | None | No visible changes |
| Nurse Dashboard | Minor | Low | Doctor dropdown if multiple doctors |
| Patient Status Page | Internal | None | No visible changes |
| Home Page (Search) | None/Minor | Low | Possible disambiguation page |
| Admin Dashboard | New | N/A | Full new dashboard for owners |
| Settings Page | Moderate | Medium | Move to admin section |
| QR Codes | Internal | None | Legacy QR code handling |

**Total New Pages:** 3-4 (owner onboarding, admin dashboard, admin settings, optional disambiguation)
**Modified Pages:** 2-3 (login, nurse dashboard, settings)
**Preserved Pages:** 7+ (doctor dashboard, history, profile, nurse profile, status page, home page)

---

## Migration Strategy

### Goals

1. **Zero Data Loss:** Preserve all existing patients, doctors, nurses, settings
2. **Zero Downtime:** Migration can happen in production without service interruption
3. **Backward Compatibility:** Old queries still work during migration period
4. **Rollback Plan:** Ability to revert if issues arise

### Migration Phases

#### Phase 1: Data Model Preparation (Non-Breaking)

**Duration:** 1-2 days
**Risk Level:** Low

**Actions:**
1. Create new collections (empty): `clinics`, `userProfiles`, `invitations`
2. Update TypeScript interfaces to include optional `clinicId` fields
3. Deploy updated code that supports BOTH old and new data models
4. No data migration yet - just schema preparation

**Code Pattern:**

```typescript
// Support both old and new data models
export const listenToQueue = (
    doctorIdOrUid: string,  // Can be doctorId or auth UID
    clinicId?: string,      // Optional for now
    callback: (patients: PatientInQueue[]) => void
) => {
    const q = clinicId
        ? query(collection(db, 'patients'),
            where("clinicId", "==", clinicId),
            where("doctorId", "==", doctorIdOrUid))
        : query(collection(db, 'patients'),
            where("doctorId", "==", doctorIdOrUid));
    // ... rest
}
```

#### Phase 2: Create Default Clinic (Migrate Existing Data)

**Duration:** 1 day
**Risk Level:** Low

**Actions:**
1. Create a "Default Clinic" document in `clinics` collection
2. Migrate all existing doctors to new structure
3. Migrate all existing nurses to new structure
4. Create `userProfiles` entries for all existing users
5. Update all existing `patients` documents to include `clinicId`

**Migration Script (Server Action):**

```typescript
// scripts/migrate-to-multi-tenant.ts
export async function migrateToMultiTenant() {
  const db = admin.firestore();

  // 1. Create default clinic
  const defaultClinic = {
    name: "Default Clinic",
    ownerId: "", // Will be set to first doctor
    ownerName: "",
    ownerEmail: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    settings: {
      consultationTime: 15,
      consultationCost: 200,
      reConsultationCost: 100,
      timezone: "Africa/Cairo",
      language: "ar",
    },
    phoneNumbers: [],
    locations: [],
  };

  const clinicRef = await db.collection('clinics').add(defaultClinic);
  const clinicId = clinicRef.id;

  console.log(`Created default clinic: ${clinicId}`);

  // 2. Migrate doctors
  const doctorsSnapshot = await db.collection('doctors').get();
  const batch = db.batch();
  let firstDoctorUid = "";

  for (const docSnap of doctorsSnapshot.docs) {
    const oldData = docSnap.data();
    const userId = docSnap.id; // Old doc ID = auth UID

    if (!firstDoctorUid) firstDoctorUid = userId;

    // Create new doctor document
    const newDoctorRef = db.collection('doctors').doc(); // Auto-generated ID
    batch.set(newDoctorRef, {
      userId: userId,
      clinicId: clinicId,
      name: oldData.name,
      email: oldData.email || "",
      specialty: oldData.specialty,
      avatarUrl: oldData.avatarUrl,
      isActive: true,
      isAvailable: oldData.isAvailable ?? true,
      totalRevenue: oldData.totalRevenue || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: userId,
    });

    // Create userProfile
    const userProfileRef = db.collection('userProfiles').doc(userId);
    batch.set(userProfileRef, {
      uid: userId,
      email: oldData.email || "",
      displayName: oldData.name,
      clinicId: clinicId,
      role: 'doctor',
      doctorId: newDoctorRef.id,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Migrated doctor: ${oldData.name} (${userId}) -> ${newDoctorRef.id}`);
  }

  // 3. Set first doctor as owner
  if (firstDoctorUid) {
    batch.update(clinicRef, {
      ownerId: firstDoctorUid,
    });

    // Update first doctor's userProfile to owner role
    const firstUserProfileRef = db.collection('userProfiles').doc(firstDoctorUid);
    batch.update(firstUserProfileRef, {
      role: 'owner',
    });
  }

  // 4. Migrate nurses (similar to doctors)
  const nursesSnapshot = await db.collection('nurses').get();

  for (const docSnap of nursesSnapshot.docs) {
    const oldData = docSnap.data();
    const userId = docSnap.id; // Old doc ID = auth UID

    // Create new nurse document
    const newNurseRef = db.collection('nurses').doc(); // Auto-generated ID
    batch.set(newNurseRef, {
      userId: userId,
      clinicId: clinicId,
      name: oldData.name,
      email: oldData.email,
      avatarUrl: oldData.avatarUrl,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: firstDoctorUid,
    });

    // Create userProfile
    const userProfileRef = db.collection('userProfiles').doc(userId);
    batch.set(userProfileRef, {
      uid: userId,
      email: oldData.email,
      displayName: oldData.name,
      clinicId: clinicId,
      role: 'nurse',
      nurseId: newNurseRef.id,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Migrated nurse: ${oldData.name} (${userId}) -> ${newNurseRef.id}`);
  }

  await batch.commit();

  // 5. Migrate patients (add clinicId)
  const patientsSnapshot = await db.collection('patients').get();
  const patientBatches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const docSnap of patientsSnapshot.docs) {
    const oldData = docSnap.data();

    // Find the new doctorId by looking up userProfile
    const userProfileSnap = await db.collection('userProfiles')
      .where('uid', '==', oldData.doctorId)
      .limit(1)
      .get();

    if (!userProfileSnap.empty) {
      const userProfile = userProfileSnap.docs[0].data();

      currentBatch.update(docSnap.ref, {
        clinicId: userProfile.clinicId,
        doctorId: userProfile.doctorId, // Update to new doctor document ID
        nurseId: userProfile.nurseId || oldData.nurseId, // Update to new nurse document ID if available
      });

      batchCount++;

      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        patientBatches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    patientBatches.push(currentBatch);
  }

  // Commit all patient batches
  for (let i = 0; i < patientBatches.length; i++) {
    await patientBatches[i].commit();
    console.log(`Committed patient batch ${i + 1}/${patientBatches.length}`);
  }

  console.log('Migration complete!');
}
```

**Execution:**
- Run as server action or admin script
- Can be triggered via admin panel: `/admin/migrate`
- Run during low-traffic hours
- Monitor Firestore console for errors

**Verification:**
- Check that all doctors have corresponding `userProfiles` entries
- Check that all patients have `clinicId` field
- Check that clinic document exists with correct ownerId
- Test login flow with existing credentials

#### Phase 3: Deploy Multi-Tenant Code

**Duration:** 1 day
**Risk Level:** Medium

**Actions:**
1. Deploy updated authentication logic (use `userProfiles` for routing)
2. Update all queries to use `clinicId` filter
3. Deploy new admin dashboard
4. Update nurse dashboard to show doctor selection
5. Keep backward compatibility for old QR codes

**Rollback Plan:**
- Keep old code in a git branch
- If issues arise, revert deployment
- Old data structure is still intact (just with extra `clinicId` fields)

#### Phase 4: Cleanup (Optional)

**Duration:** 1 week after Phase 3
**Risk Level:** Low

**Actions:**
1. After verifying everything works, archive old `doctors` and `nurses` collections (don't delete yet)
2. Remove backward compatibility code
3. Update QR code migration handler to show "upgrade" message for old QR codes

### Handling Edge Cases

#### Case 1: Doctor/Nurse Shared UID

**Current Issue:** Doctors and nurses share the same Firebase auth UID

**Migration Solution:**
- During migration, if a UID is found in both `doctors` and `nurses`, treat it as a doctor
- Create a userProfile with `role: 'doctor'`
- Nurses will need separate accounts after migration
- Owner can invite nurses with their own email addresses

**User Communication:**
"نظرًا لتحديث النظام، يجب على الممرضين التسجيل بحسابات منفصلة. سيتم إرسال دعوات عبر البريد الإلكتروني."

#### Case 2: Multiple Clinics for Same Doctor

**Current Issue:** A doctor might have separate Firebase accounts if they work at multiple locations

**Migration Solution:**
- Each Firebase account becomes a separate clinic during default migration
- After migration, owner can manually merge or invite doctor to additional clinics (future feature)

#### Case 3: Patients with Old QR Codes

**Solution:** Legacy URL handler

```typescript
// In status page
async function getPatientWithLegacySupport(doctorIdOrUid: string, phone: string) {
  // Try new system first
  let patient = await getPatientByDoctorId(doctorIdOrUid, phone);

  if (!patient) {
    // Try legacy system (doctorId = auth UID)
    const userProfileSnap = await getDoc(doc(db, 'userProfiles', doctorIdOrUid));
    if (userProfileSnap.exists()) {
      const profile = userProfileSnap.data();
      patient = await getPatientByDoctorId(profile.doctorId, phone);
    }
  }

  return patient;
}
```

### Migration Testing Plan

**Pre-Migration:**
1. Create staging environment with copy of production data
2. Run migration script on staging
3. Test all critical user flows:
   - Doctor login → Dashboard → View patients
   - Nurse login → Dashboard → Register patient
   - Patient search → Status page
   - QR code scan → Status page
   - Doctor write prescription → Save

**Post-Migration (Production):**
1. Monitor Firestore logs for errors
2. Monitor authentication failures
3. Check patient registration success rate
4. Verify QR codes still work
5. Have rollback plan ready (revert code deployment)

**Success Metrics:**
- Zero authentication errors
- Zero patient registration failures
- All existing QR codes resolve to status pages
- All doctors can access their patients

---

## Firestore Security Rules Impact

### Current Rules (Assumed)

```javascript
// Likely very permissive or client-side only
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Patients: probably authenticated users can read/write
    match /patients/{patientId} {
      allow read, write: if request.auth != null;
    }

    // Doctors: probably own profile only
    match /doctors/{doctorId} {
      allow read, write: if request.auth != null && request.auth.uid == doctorId;
    }

    // Nurses: similar to doctors
    match /nurses/{nurseId} {
      allow read, write: if request.auth != null && request.auth.uid == nurseId;
    }

    // Clinic info: probably open read, authenticated write
    match /clinicInfo/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Proposed Multi-Tenant Rules

**Goal:** Strict data isolation by clinicId

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to get user's profile
    function getUserProfile() {
      return get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data;
    }

    // Helper function to check if user belongs to a clinic
    function belongsToClinic(clinicId) {
      return request.auth != null && getUserProfile().clinicId == clinicId;
    }

    // Helper function to check if user has a specific role
    function hasRole(role) {
      return request.auth != null && getUserProfile().role == role;
    }

    // Helper function to check if user is clinic owner
    function isClinicOwner(clinicId) {
      return belongsToClinic(clinicId) && hasRole('owner');
    }

    // Clinics collection
    match /clinics/{clinicId} {
      // Anyone authenticated can read their own clinic
      allow read: if belongsToClinic(clinicId);

      // Only owner can update clinic
      allow update: if isClinicOwner(clinicId);

      // Creating clinics is handled by backend (during onboarding)
      allow create: if request.auth != null;
    }

    // User profiles collection
    match /userProfiles/{userId} {
      // Users can read their own profile
      allow read: if request.auth != null && request.auth.uid == userId;

      // Only system (backend) can create/update profiles during onboarding/invitation
      // Or clinic owner can update profiles of users in their clinic
      allow write: if false; // Handled by backend only
    }

    // Doctors collection
    match /doctors/{doctorId} {
      // Users in the same clinic can read doctor profiles
      allow read: if belongsToClinic(resource.data.clinicId);

      // Doctors can update their own profile
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid;

      // Only clinic owner can create/delete doctors
      allow create, delete: if isClinicOwner(request.resource.data.clinicId);
    }

    // Nurses collection
    match /nurses/{nurseId} {
      // Users in the same clinic can read nurse profiles
      allow read: if belongsToClinic(resource.data.clinicId);

      // Nurses can update their own profile
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid;

      // Only clinic owner can create/delete nurses
      allow create, delete: if isClinicOwner(request.resource.data.clinicId);
    }

    // Patients collection
    match /patients/{patientId} {
      // Allow reading patients from own clinic
      allow read: if request.auth != null
        && belongsToClinic(resource.data.clinicId);

      // Allow creating patients if user is in the same clinic
      allow create: if request.auth != null
        && belongsToClinic(request.resource.data.clinicId);

      // Allow updating patients if user is in the same clinic
      allow update: if request.auth != null
        && belongsToClinic(resource.data.clinicId);

      // Only clinic owner can delete patients
      allow delete: if isClinicOwner(resource.data.clinicId);
    }

    // Invitations collection
    match /invitations/{invitationId} {
      // Only clinic owner can read/create invitations for their clinic
      allow read, create: if isClinicOwner(resource.data.clinicId);

      // Users can read invitations sent to their email
      allow read: if request.auth != null
        && request.auth.token.email == resource.data.email;

      // System updates invitation status (handled by backend)
      allow update: if false; // Backend only
    }
  }
}
```

### Important Notes on Security Rules

**Performance Consideration:**
- `getUserProfile()` function performs a Firestore `get()` operation
- This counts toward read quota
- Consider caching user profile in custom claims for frequently used checks

**Alternative: Custom Claims for Performance**

```javascript
// Set during login/profile update
await authAdmin().setCustomUserClaims(user.uid, {
  clinicId: 'clinic_abc123',
  role: 'doctor'
});

// In security rules
function getClinicId() {
  return request.auth.token.clinicId;
}

function getRole() {
  return request.auth.token.role;
}
```

**Hybrid Approach (Recommended):**
- Use custom claims for basic checks (clinicId, role)
- Use userProfiles for detailed profile data
- Update custom claims whenever user changes clinics or roles

### Public Access (Patient Status Page)

**Challenge:** Status page is public (no auth), but we need to enforce clinic isolation

**Solution:** Use server-side data fetching with access token

```typescript
// app/status/[doctorId]/[phone]/page.tsx
export default async function PatientStatusPage({ params }) {
  const { doctorId, phone } = params;

  // Server-side fetch (bypasses client security rules)
  const patient = await getPatientByDoctorIdAndPhone(doctorId, phone);

  if (!patient) {
    return <div>Patient not found</div>;
  }

  // Pass data to client component
  return <PatientStatusDisplay initialData={patient} />;
}
```

**Security:** Server actions use Admin SDK, which bypasses security rules but runs in trusted environment.

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Set up multi-tenant data structures without breaking existing functionality

**Tasks:**
- [ ] Create new collections: `clinics`, `userProfiles`, `invitations`
- [ ] Update TypeScript interfaces to include `clinicId` fields (optional)
- [ ] Create migration script to generate default clinic
- [ ] Create `userProfiles` entries for existing users
- [ ] Update all existing `patients` documents with `clinicId`
- [ ] Test migration script on staging environment

**Deliverables:**
- Migration script (server action)
- Updated TypeScript interfaces
- Staging environment with migrated data

**Risk:** Low - no code changes yet, just data preparation

---

### Phase 2: Authentication & Profile System (Week 2)

**Goal:** Implement new authentication flow using `userProfiles`

**Tasks:**
- [ ] Create `getUserProfile()` service function
- [ ] Update `DoctorProfileProvider` to fetch user profile first
- [ ] Update `NurseProfileProvider` to fetch user profile first
- [ ] Create new auth context: `UserProfileProvider` (wraps both doctor/nurse)
- [ ] Update login flow to redirect based on profile role
- [ ] Create owner onboarding flow (`/onboarding/clinic`)
- [ ] Test authentication flows with existing users

**Files to Modify:**
- `src/services/authService.ts`
- `src/services/authClientService.ts`
- `src/components/doctor/doctor-profile-provider.tsx`
- `src/components/nurse/nurse-profile-provider.tsx`
- `src/components/login-tabs.tsx`

**New Files:**
- `src/components/auth/user-profile-provider.tsx`
- `src/app/onboarding/clinic/page.tsx`
- `src/services/userProfileService.ts`

**Deliverables:**
- Updated authentication system
- Owner onboarding flow
- All existing users can still log in

**Risk:** Medium - core auth changes, but with backward compatibility

---

### Phase 3: Update Data Services (Week 3)

**Goal:** Add `clinicId` to all Firestore queries

**Tasks:**
- [ ] Update `queueService.ts` to include `clinicId` in all queries
- [ ] Update `queueService.admin.ts` to include `clinicId` in all operations
- [ ] Create new service: `clinicService.ts` for clinic-specific operations
- [ ] Update all components to pass `clinicId` from user profile
- [ ] Test all CRUD operations (create patient, update status, etc.)

**Files to Modify:**
- `src/services/queueService.ts` (20+ functions)
- `src/services/queueService.admin.ts`

**New Files:**
- `src/services/clinicService.ts`

**Key Functions to Update:**
- `addPatientToQueue()` - Add clinicId to patient document
- `listenToQueue()` - Filter by clinicId + doctorId
- `getPatientByPhone()` - Add clinicId parameter
- `updateDoctorRevenue()` - Use new doctor document ID

**Deliverables:**
- All services support multi-tenancy
- Existing users see only their clinic's data

**Risk:** High - core data access changes, extensive testing required

---

### Phase 4: Update Doctor UI (Week 4)

**Goal:** Update doctor dashboard and related pages

**Tasks:**
- [ ] Update doctor dashboard to use new data services
- [ ] Update patient history page
- [ ] Update prescription editor
- [ ] Update doctor profile page
- [ ] Move settings to admin-only (or add permission check)
- [ ] Test all doctor workflows

**Files to Modify:**
- `src/app/doctor/dashboard/page.tsx`
- `src/components/doctor/doctor-dashboard-client.tsx`
- `src/app/doctor/history/page.tsx`
- `src/app/doctor/settings/page.tsx`

**Deliverables:**
- Doctor dashboard fully supports multi-tenancy
- Doctors see only their own patients within their clinic

**Risk:** Low - mostly UI updates, data services already updated

---

### Phase 5: Update Nurse UI (Week 4-5)

**Goal:** Update nurse dashboard with doctor selection

**Tasks:**
- [ ] Update nurse dashboard to fetch clinic doctors
- [ ] Add doctor selection dropdown to patient registration form
- [ ] Update queue display to support multiple doctors
- [ ] Update QR code generation to use new doctor document IDs
- [ ] Test patient registration workflow

**Files to Modify:**
- `src/app/nurse/dashboard/page.tsx`
- `src/components/nurse/patient-registration-form.tsx`
- `src/components/nurse/queue-display.tsx`

**New Components:**
- `<DoctorSelector />` (dropdown to select doctor)

**Deliverables:**
- Nurses can register patients for any doctor in their clinic
- QR codes use new doctor document IDs

**Risk:** Low - straightforward UI updates

---

### Phase 6: Admin Dashboard (Week 5-6)

**Goal:** Create clinic owner dashboard for staff management

**Tasks:**
- [ ] Create admin layout with sidebar
- [ ] Implement staff list page (doctors + nurses)
- [ ] Implement staff invitation flow (email invitations)
- [ ] Implement clinic settings page
- [ ] Implement clinic statistics page
- [ ] Create invitation acceptance flow (`/invite?token=...`)
- [ ] Test full staff onboarding workflow

**New Files:**
- `src/app/admin/layout.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/staff/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/statistics/page.tsx`
- `src/app/invite/page.tsx`
- `src/components/admin/staff-list.tsx`
- `src/components/admin/invite-staff-form.tsx`
- `src/services/invitationService.ts`

**Deliverables:**
- Full admin dashboard for clinic owners
- Staff invitation and onboarding system

**Risk:** Low - new features, no impact on existing workflows

---

### Phase 7: Public Pages & QR Codes (Week 6)

**Goal:** Update public patient status page and QR code handling

**Tasks:**
- [ ] Update status page to support new doctor document IDs
- [ ] Implement legacy QR code handler (for old UIDs)
- [ ] Update home page patient search
- [ ] Implement disambiguation page (if patient in multiple clinics)
- [ ] Test all public flows (search, QR scan, status view)

**Files to Modify:**
- `src/app/status/[doctorId]/[phone]/page.tsx`
- `src/app/page.tsx`
- `src/components/patient-search-form.tsx`

**New Files:**
- `src/app/search-results/page.tsx` (disambiguation)

**Deliverables:**
- All public flows work with new data model
- Legacy QR codes redirect to new URLs

**Risk:** Medium - public-facing changes, need thorough testing

---

### Phase 8: Firestore Security Rules (Week 7)

**Goal:** Implement strict data isolation rules

**Tasks:**
- [ ] Write new Firestore security rules
- [ ] Deploy rules to staging environment
- [ ] Test all user flows with rules enabled
- [ ] Fix any permission errors
- [ ] Deploy rules to production
- [ ] Monitor for permission errors

**Deliverables:**
- Production-ready security rules
- Complete data isolation between clinics

**Risk:** High - incorrect rules can break access, requires extensive testing

---

### Phase 9: Testing & Optimization (Week 8)

**Goal:** Comprehensive testing and performance optimization

**Tasks:**
- [ ] End-to-end testing of all user flows
- [ ] Load testing (simulate 10+ clinics, 100+ patients)
- [ ] Optimize Firestore queries (add composite indexes)
- [ ] Monitor performance metrics
- [ ] Fix any bugs found during testing
- [ ] User acceptance testing with pilot clinic

**Deliverables:**
- Fully tested multi-tenant system
- Performance benchmarks
- Bug-free production release

**Risk:** Low - testing phase, no new features

---

### Phase 10: Migration & Launch (Week 9)

**Goal:** Migrate production data and launch multi-tenant system

**Tasks:**
- [ ] Schedule maintenance window (low-traffic hours)
- [ ] Run migration script on production
- [ ] Deploy multi-tenant code
- [ ] Monitor for errors
- [ ] Verify all existing users can log in
- [ ] Verify all data is accessible
- [ ] Send announcement to users about new features
- [ ] Provide support for any migration issues

**Rollback Plan:**
- Revert code deployment (keep migrated data)
- Old code can still work with new data (clinicId fields are optional in old code)

**Deliverables:**
- Production system running on multi-tenant model
- All existing users migrated successfully
- Zero downtime

**Risk:** Medium - production migration always carries risk, but with proper testing and rollback plan

---

## Risk Assessment

### Top 5 Risky Areas in Current Code

#### 1. **Doctor/Nurse Shared UID (Critical Risk)**

**Location:** Throughout the codebase, especially:
- [src/components/nurse/patient-registration-form.tsx:97](../src/components/nurse/patient-registration-form.tsx:97)
- [src/services/queueService.ts](../src/services/queueService.ts)

**Issue:**
```typescript
// Both doctorId and nurseId are the same UID
doctorId: user.uid,
nurseId: user.uid,
```

**Impact:**
- After multi-tenancy, doctors and nurses need separate accounts
- Existing doctors who also act as nurses will need to decide on primary role
- Patient data currently has `doctorId` = nurse's UID in some cases

**Mitigation:**
- During migration, treat shared UIDs as doctors (primary role)
- Create invitation system for nurses to get their own accounts
- Update all patient records to use correct doctor document IDs
- Provide clear communication to users about account separation

**Severity:** 🔴 Critical

---

#### 2. **Direct UID-Based Queries (High Risk)**

**Location:** All query functions in [src/services/queueService.ts](../src/services/queueService.ts)

**Issue:**
```typescript
// Current: doctorId = Firebase auth UID
where("doctorId", "==", user.uid)

// After migration: doctorId = doctor document ID
where("doctorId", "==", doctorProfile.id)
```

**Impact:**
- 20+ functions need to be updated
- Every query must add `clinicId` filter for data isolation
- Risk of missing a query and breaking data isolation
- Existing patient records have old UIDs as doctorId

**Mitigation:**
- Comprehensive search for all `where("doctorId"` queries
- Update TypeScript interfaces to make `clinicId` required (compile-time checks)
- Write integration tests for every query function
- Use linter rules to enforce clinicId in queries

**Severity:** 🔴 High

---

#### 3. **Global Clinic Settings (Medium Risk)**

**Location:** [src/services/queueService.ts:383-413](../src/services/queueService.ts:383-413)

**Issue:**
```typescript
// Current: Single global settings document
const settingsDocRef = doc(db, 'clinicInfo', 'settings');

// After migration: Settings per clinic
const settingsDocRef = doc(db, 'clinics', clinicId);
```

**Impact:**
- All clinics currently share the same settings
- Revenue calculations use global costs
- After migration, each clinic has its own pricing
- Historical patient revenue calculations may be incorrect

**Mitigation:**
- Migrate global settings to default clinic during migration
- Update all settings reads/writes to be clinic-scoped
- Recalculate revenue for historical patients (or accept as-is)
- Clearly document settings migration in release notes

**Severity:** 🟡 Medium

---

#### 4. **Public Patient Search (Medium Risk)**

**Location:** [src/components/patient-search-form.tsx:39](../src/components/patient-search-form.tsx:39)

**Issue:**
```typescript
// Current: Search across ALL doctors
const result = await getPatientByPhoneAcrossClinics(phone);

// After migration: May find patient in multiple clinics
```

**Impact:**
- Patient may have appointments in multiple clinics
- Current code assumes one result, redirects immediately
- Need disambiguation UI if multiple results found
- QR codes are clinic+doctor specific, so search must respect that

**Mitigation:**
- Implement disambiguation page for multiple results
- Consider adding clinic selector to home page
- Keep global search for simplicity (most patients in one clinic)
- Handle edge case gracefully with clear UI

**Severity:** 🟡 Medium

---

#### 5. **QR Code URLs with UIDs (Medium Risk)**

**Location:** QR code generation in nurse dashboard

**Issue:**
```typescript
// Current QR code URL
`${baseUrl}/status/${user.uid}/${phone}`

// After migration
`${baseUrl}/status/${doctorProfile.id}/${phone}`
```

**Impact:**
- All existing QR codes will break after migration
- Patients with printed/saved QR codes will get errors
- Status page needs to handle both old and new formats
- Can't distinguish between old UID and new document ID in URL

**Mitigation:**
- Implement legacy URL handler in status page
- Try new format first, fall back to legacy lookup
- Add migration notice on status page: "يرجى الحصول على رمز QR جديد"
- Provide re-generation feature in nurse dashboard
- Keep legacy handler for 3-6 months

**Severity:** 🟡 Medium

---

### Other Risks

#### Performance Risks

**Issue:** Adding `clinicId` to queries increases index requirements

**Mitigation:**
- Create composite indexes before launch
- Monitor query performance
- Use Firestore query explain for optimization

**Severity:** 🟢 Low

---

#### User Experience Risks

**Issue:** Existing users need to understand new multi-tenant model

**Mitigation:**
- Clear onboarding for new features (admin dashboard)
- Email announcements before migration
- In-app notifications about new features
- Help documentation in Arabic

**Severity:** 🟢 Low

---

#### Data Loss Risks

**Issue:** Migration script could fail or corrupt data

**Mitigation:**
- Export full Firestore backup before migration
- Run migration on staging first
- Use Firestore transactions for atomic updates
- Implement rollback plan
- Monitor migration progress with detailed logging

**Severity:** 🔴 Critical (but mitigated with proper planning)

---

## Open Questions

### 1. Owner Role vs Doctor Role

**Question:** Should the clinic owner always be a doctor? Or can they be a non-doctor admin?

**Options:**
- A) Owner is always a doctor (gets both owner + doctor permissions)
- B) Owner is a separate role (admin-only, no clinical access)
- C) Owner can choose to be doctor or pure admin

**Recommendation:** Option A - Owner is always a doctor
- Simplifies onboarding (doctor signs up → becomes owner → invites staff)
- Matches business model (doctors buy the system)
- Owner still needs clinical access for their own patients

**Impact on Implementation:** Owner userProfile has both `role: 'owner'` and `doctorId: '...'`

---

### 2. Nurse Assignment to Doctors

**Question:** Should nurses be assigned to specific doctors, or can they register patients for any doctor in the clinic?

**Options:**
- A) Nurses can register for any doctor in clinic (current model)
- B) Nurses are assigned to specific doctors only
- C) Owner decides (configurable per nurse)

**Recommendation:** Option A initially, add Option C later
- Simplifies initial implementation
- More flexible for small clinics (1-2 doctors)
- Can add `assignedDoctorIds` field to nurses later

**Impact on Implementation:** Nurse registration form shows all clinic doctors in dropdown

---

### 3. Subdomain vs Single Domain

**Question:** Should each clinic get a subdomain (e.g., `dr-ali.queuewise.com`)?

**Options:**
- A) Single domain (`queuewise.com`) with clinic context in URL or user session
- B) Subdomains for each clinic (white-label experience)

**Recommendation:** Option A initially, add Option B as premium feature
- Simpler infrastructure (no wildcard SSL, no DNS management)
- Easier for users (single domain to remember)
- Subdomains can be added later as SaaS upsell

**Impact on Implementation:** None for Step 1-2, can be added in Step 3+

---

### 4. Patient Self-Service Booking

**Question:** Business requirement says "patients can self-book." Should we build a booking form or keep nurse-only registration?

**Current State:** Only nurses can register patients

**Options:**
- A) Keep nurse-only registration (simpler)
- B) Add public booking form (patients self-register)
- C) Add booking form, but require nurse approval

**Recommendation:** Clarify with stakeholders
- If booking form is required, it's a significant new feature (Phase 11)
- Needs patient authentication (phone OTP)
- Needs appointment slot management
- May conflict with walk-in queue model

**Impact on Implementation:** Major if required. Suggest deferring to Step 3.

---

### 5. Migration Timing

**Question:** Should migration happen all at once or gradually?

**Options:**
- A) Big-bang migration (migrate all data at once)
- B) Gradual migration (new clinics use new model, old clinics stay on old model)
- C) Opt-in migration (existing clinics can choose when to migrate)

**Recommendation:** Option A - Big-bang migration
- Maintaining two data models is complex and error-prone
- Security rules are easier with single model
- Can be done with minimal downtime (1-2 hours)

**Impact on Implementation:** Requires careful planning and testing, but cleaner long-term

---

## Next Steps

### Recommended Next Step: Stakeholder Approval

**What to do:**
1. Review this document with stakeholders
2. Clarify open questions (see section above)
3. Get approval on proposed data model
4. Get approval on migration strategy
5. Confirm timeline (9-week estimate)

**After Approval:**
- Proceed to Phase 1 (Foundation)
- Set up project tracking (GitHub issues or similar)
- Assign tasks to team members
- Schedule weekly check-ins

---

## Appendix

### A. File Paths Reference

#### Core Services
- Authentication: `src/services/authService.ts`
- Queue Management: `src/services/queueService.ts`
- Admin Queue: `src/services/queueService.admin.ts`

#### Contexts/Providers
- Doctor Profile: `src/components/doctor/doctor-profile-provider.tsx`
- Nurse Profile: `src/components/nurse/nurse-profile-provider.tsx`

#### Pages
- Doctor Dashboard: `src/app/doctor/dashboard/page.tsx`
- Nurse Dashboard: `src/app/nurse/dashboard/page.tsx`
- Patient Status: `src/app/status/[doctorId]/[phone]/page.tsx`
- Home (Search): `src/app/page.tsx`
- Login: `src/app/login/page.tsx`

#### Key Components
- Patient Registration: `src/components/nurse/patient-registration-form.tsx`
- Patient Search: `src/components/patient-search-form.tsx`

### B. Glossary

| Term | Definition |
|------|------------|
| **Clinic** | A tenant in the multi-tenant system; one clinic account |
| **Owner** | The clinic owner/admin who purchased the system |
| **Doctor** | A doctor employed by the clinic |
| **Nurse** | A nurse employed by the clinic |
| **Patient** | A person seeking medical consultation |
| **Queue** | The list of waiting patients for a specific doctor |
| **Queue Number** | Daily incremental number assigned to each patient |
| **Status** | Patient state: Waiting, Consulting, or Finished |
| **QueueType** | Consultation (new) or Re-consultation (returning patient) |
| **userProfiles** | Firestore collection mapping Firebase auth UID to clinic + role |
| **clinicId** | Unique identifier for a clinic account |
| **doctorId** | Unique identifier for a doctor document (not Firebase UID after migration) |

### C. Estimated Timeline

| Phase | Duration | Effort (Person-Days) |
|-------|----------|---------------------|
| Phase 1: Foundation | Week 1 | 3-4 days |
| Phase 2: Authentication | Week 2 | 4-5 days |
| Phase 3: Data Services | Week 3 | 5-7 days |
| Phase 4: Doctor UI | Week 4 | 3-4 days |
| Phase 5: Nurse UI | Week 4-5 | 3-4 days |
| Phase 6: Admin Dashboard | Week 5-6 | 7-10 days |
| Phase 7: Public Pages | Week 6 | 3-4 days |
| Phase 8: Security Rules | Week 7 | 3-4 days |
| Phase 9: Testing | Week 8 | 5-7 days |
| Phase 10: Migration & Launch | Week 9 | 2-3 days |
| **Total** | **9 weeks** | **~45 days** |

**Assumptions:**
- 1 senior full-stack developer
- 5-day work weeks
- Includes time for testing and bug fixes
- Excludes patient self-service booking feature

---

**Document Version:** 1.0
**Last Updated:** December 18, 2025
**Status:** Awaiting Stakeholder Approval
