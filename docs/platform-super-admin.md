# Platform Super Admin

## Overview

Platform Super Admin is a system for managing clinic customers (clients) in the QueueWise multi-tenant clinic management system. Platform admins can create new clinics, manage subscriptions, and suspend/reactivate/cancel client access.

### Architecture Principles

**CRITICAL: Server-Side Only Architecture**
- All `platformClients` data operations MUST go through `/api/platform/*` routes using Firebase Admin SDK
- Frontend NEVER reads/writes `platformClients` collection directly (Firestore rules deny all client access)
- Frontend uses Firebase Auth ONLY for `getIdToken()` to call APIs
- All API routes use centralized auth helper: `verifyPlatformAdmin(request)`
- This ensures consistent authorization and prevents direct Firestore manipulation

---

## Architecture

### Data Model

#### 1. Platform Admins Collection
**Collection:** `platformAdmins/{uid}`

```typescript
{
  uid: string;              // Firebase Auth UID (document ID)
  email: string;            // Admin email
  displayName?: string;     // Admin display name
  isActive: boolean;        // Active status (can be deactivated)
  createdAt: Timestamp;     // Creation timestamp
  createdBy?: string;       // UID of creator (for audit trail)
}
```

#### 2. Platform Clients Collection
**Collection:** `platformClients/{clientId}`

```typescript
{
  id: string;                        // Document ID
  clinicId: string;                  // Reference to clinics collection
  clinicName: string;                // Denormalized clinic name
  clinicSlug: string;                // Denormalized clinic slug
  ownerUid: string;                  // Firebase Auth UID of owner
  ownerEmail: string;                // Owner email
  ownerName?: string;                // Owner display name
  plan: 'monthly' | 'yearly';        // Subscription plan
  status: 'active' | 'suspended' | 'canceled';  // Subscription status
  currentPeriodStart: Timestamp;     // Billing period start
  currentPeriodEnd: Timestamp;       // Billing period end
  createdAt: Timestamp;              // Creation timestamp
  updatedAt: Timestamp;              // Last update timestamp
  canceledAt?: Timestamp;            // Cancellation timestamp (if applicable)
  createdBy: string;                 // UID of platform admin who created
  lastModifiedBy?: string;           // UID of last modifier
}
```

#### 3. Enhanced Clinic Document
```typescript
{
  // ... existing fields
  ownerUid: string;          // Required for platform admin management
  isActive: boolean;         // Controls clinic access
  subscriptionStatus: 'active' | 'suspended' | 'cancelled';
}
```

#### 4. User Profile (Owner Role)
```typescript
{
  uid: string;
  email: string;
  clinicId: string;
  role: 'owner';             // Platform creates owners
  doctorId: string;          // Owners are also doctors
  isActive: boolean;
  createdAt: Timestamp;
}
```

---

## Authorization

### How It Works

1. **Middleware Protection** (`src/middleware.ts`)
   - Checks if user is logged in before accessing `/platform/*` routes
   - Redirects to login if not authenticated
   - Basic check only (full verification in page/API)

2. **Client-Side Authorization** (`src/services/platformAdminService.ts`)
   - Checks `platformAdmins/{uid}` collection
   - Verifies `isActive === true`
   - Used in frontend to show/hide admin features

3. **Server-Side Authorization** (All API routes)
   - Verifies Firebase ID token
   - Checks `platformAdmins/{uid}` document exists and `isActive === true`
   - Returns 401 Unauthorized or 403 Forbidden if not authorized
   - **Never trust frontend** - always verify in API routes

---

## API Endpoints

### 1. Create Client
**POST** `/api/platform/clients`

**Headers:**
```
Authorization: Bearer {Firebase ID Token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "ownerEmail": "owner@example.com",
  "clinicName": "My Clinic",
  "clinicSlug": "my-clinic",      // Optional
  "plan": "monthly"                // Optional (default: monthly)
}
```

**Response:**
```json
{
  "ok": true,
  "clientId": "abc123",
  "clinicId": "xyz789",
  "ownerUid": "user123",
  "resetLink": "https://...",
  "isNewUser": true,
  "message": "Client created successfully with new owner account"
}
```

**What It Does:**
1. Creates clinic document with unique slug
2. Creates or retrieves Firebase Auth user for owner email
3. Creates `userProfiles/{ownerUid}` with role='owner'
4. Creates `doctors/{doctorId}` document for owner
5. Creates `platformClients/{clientId}` with monthly billing period
6. Generates password reset link for owner activation
7. Returns all IDs and reset link

---

### 2. Get Password Reset Link
**POST** `/api/platform/clients/{clientId}/reset-link`

**Headers:**
```
Authorization: Bearer {Firebase ID Token}
```

**Response:**
```json
{
  "ok": true,
  "resetLink": "https://...",
  "ownerEmail": "owner@example.com"
}
```

**What It Does:**
- Retrieves client's owner email
- Generates new password reset link
- Returns link for sharing with owner

---

### 3. Suspend Client
**POST** `/api/platform/clients/{clientId}/suspend`

**Headers:**
```
Authorization: Bearer {Firebase ID Token}
```

**Response:**
```json
{
  "ok": true,
  "message": "Client suspended successfully",
  "clientId": "abc123",
  "clinicId": "xyz789",
  "usersDisabled": 5
}
```

**What It Does:**
1. Sets `platformClients.status = 'suspended'`
2. Sets `clinics.isActive = false`
3. Disables all Firebase Auth users with `userProfiles.clinicId == clinicId`
4. Sets `userProfiles.isActive = false` for all users

**Effect:**
- Clinic cannot be accessed by booking page
- All staff cannot log in
- Existing sessions are invalidated on next auth check

---

### 4. Reactivate Client
**POST** `/api/platform/clients/{clientId}/reactivate`

**Headers:**
```
Authorization: Bearer {Firebase ID Token}
```

**Response:**
```json
{
  "ok": true,
  "message": "Client reactivated successfully",
  "clientId": "abc123",
  "clinicId": "xyz789",
  "usersEnabled": 5
}
```

**What It Does:**
1. Sets `platformClients.status = 'active'`
2. Sets `clinics.isActive = true`
3. Enables all Firebase Auth users for this clinic
4. Sets `userProfiles.isActive = true` for all users

**Effect:**
- Clinic becomes accessible again
- All staff can log in
- Clinic appears in public booking pages

**Note:** Cannot reactivate a canceled client.

---

### 5. Cancel Client
**POST** `/api/platform/clients/{clientId}/cancel`

**Headers:**
```
Authorization: Bearer {Firebase ID Token}
```

**Response:**
```json
{
  "ok": true,
  "message": "Client canceled successfully",
  "clientId": "abc123",
  "clinicId": "xyz789",
  "usersDisabled": 5
}
```

**What It Does:**
1. Sets `platformClients.status = 'canceled'`
2. Sets `platformClients.canceledAt = now`
3. Sets `clinics.isActive = false`
4. Disables all Firebase Auth users for this clinic
5. Sets `userProfiles.isActive = false` for all users

**Effect:**
- Clinic is permanently deactivated
- Cannot be reactivated (only suspend/reactivate allows reactivation)
- All staff accounts disabled
- Data remains in Firestore (soft delete)

---

## Setup Instructions

### Step 1: Add First Platform Admin

Platform admins must be added manually to Firestore. There is no self-registration.

#### Option 1: Firebase Console (Recommended)

1. Go to Firebase Console → Firestore Database
2. Navigate to `platformAdmins` collection
3. Click "Add Document"
4. Document ID: Use the Firebase Auth UID of your admin user
5. Add fields:
   ```
   uid: {UID}               (string)
   email: admin@example.com (string)
   displayName: Admin Name  (string)
   isActive: true           (boolean)
   createdAt: {timestamp}   (timestamp - current time)
   ```
6. Save document

#### Option 2: Firebase Admin SDK Script

Create a script `scripts/addPlatformAdmin.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function addPlatformAdmin(email) {
  const db = admin.firestore();
  
  // Get user by email
  const user = await admin.auth().getUserByEmail(email);
  
  // Add to platformAdmins
  await db.collection('platformAdmins').doc(user.uid).set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || 'Platform Admin',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`Added ${email} as platform admin`);
}

// Usage
addPlatformAdmin('admin@example.com');
```

Run: `node scripts/addPlatformAdmin.js`

---

### Step 2: Configure Environment Variables

Platform Super Admin requires Firebase Admin SDK. Add these to `.env.local`:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# App URL (for password reset links)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### How to Get Service Account Key:

1. Go to Firebase Console → Project Settings
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Download JSON file
5. Extract values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

**Important:** Keep the newlines (`\n`) in `FIREBASE_PRIVATE_KEY`!

---

### Step 3: Deploy Firestore Security Rules

Ensure your `firestore.rules` allows platform admins to read `platformAdmins` collection:

```javascript
// Platform Admins: Can read their own admin status
match /platformAdmins/{adminUid} {
  allow read: if isAuthenticated() && request.auth.uid == adminUid;
}

// Platform Clients: Only platform admins (server-side only)
match /platformClients/{clientId} {
  allow read, write: if false;  // All operations via Admin SDK
}
```

Deploy: `firebase deploy --only firestore:rules`

---

## Usage Workflow

### Creating a New Client

1. **Login as Platform Admin**
   - Navigate to `/platform/clients`
   - System verifies your UID exists in `platformAdmins` collection

2. **Click "Create Client"**
   - Fill in:
     - Owner Email (required)
     - Clinic Name (required)
     - Clinic Slug (optional - auto-generated if empty)

3. **Submit Form**
   - System creates clinic + owner account + subscription
   - Password reset link is automatically copied to clipboard

4. **Send Activation Link to Owner**
   - Paste the copied link to owner via email/chat
   - Link format: `https://your-app.com/__/auth/action?mode=resetPassword&...`
   - Owner clicks link → sets password → can log in

5. **Owner Logs In**
   - Owner goes to `/login`
   - Enters email + password (set via reset link)
   - Redirected to `/doctor/dashboard` (owner is also a doctor)

---

### Suspending a Client

**When to Suspend:**
- Payment failed
- Temporary access revocation
- Under investigation
- Client requested pause

**How to Suspend:**
1. Go to `/platform/clients`
2. Find the client card
3. Click "Suspend" button
4. Confirm action

**Effect:**
- Clinic becomes inaccessible on booking pages
- All staff accounts disabled immediately
- Data remains intact (can reactivate later)

---

### Reactivating a Client

**When to Reactivate:**
- Payment received
- Investigation cleared
- Client resumed service

**How to Reactivate:**
1. Go to `/platform/clients`
2. Find the suspended client
3. Click "Reactivate" button

**Effect:**
- Clinic becomes active again
- All staff accounts re-enabled
- Booking pages show clinic again

**Note:** Cannot reactivate a canceled client (only suspended).

---

### Canceling a Client

**When to Cancel:**
- Client requests permanent closure
- Contract terminated
- Business closed

**How to Cancel:**
1. Go to `/platform/clients`
2. Find the client card
3. Click "Cancel" button
4. Confirm action (permanent!)

**Effect:**
- Clinic permanently deactivated
- All staff accounts disabled
- Cannot be reactivated (only suspend/reactivate cycle works)
- Data remains in Firestore (soft delete)

**Warning:** This is irreversible. To temporarily disable, use "Suspend" instead.

---

## Manual Testing Checklist

### Authorization Tests

- [ ] **Non-admin cannot access /platform/clients**
  - Log in as regular user (not in platformAdmins)
  - Try to visit `/platform/clients`
  - Should be redirected with "Unauthorized" message

- [ ] **Platform admin can access /platform/clients**
  - Log in as user whose UID is in platformAdmins
  - Visit `/platform/clients`
  - Should see clients list page

- [ ] **API rejects non-admin requests**
  - Use browser console to call API with regular user token
  - Should receive 403 Forbidden

---

### Create Client Tests

- [ ] **Create client with valid data**
  - Click "Create Client"
  - Fill: email=test@example.com, name=Test Clinic
  - Submit
  - Should succeed and copy reset link

- [ ] **Verify client creation in Firestore**
  - Check `platformClients` collection → new document exists
  - Check `clinics` collection → new clinic document
  - Check `userProfiles` collection → owner profile exists
  - Check `doctors` collection → owner doctor document exists

- [ ] **Auto-generate slug works**
  - Create client with name "My Test Clinic" (no slug)
  - Should auto-generate slug like "my-test-clinic"
  - Check clinic document has correct slug

- [ ] **Unique slug enforcement**
  - Create client with slug "test-clinic"
  - Try to create another with same slug
  - Should auto-append number: "test-clinic-1"

- [ ] **Password reset link works**
  - Copy activation link from creation success
  - Open in incognito browser
  - Should show Firebase password reset page
  - Set password → should redirect to /login

- [ ] **Owner can log in after activation**
  - Use reset link to set password
  - Go to /login
  - Enter email + password
  - Should log in successfully

---

### Suspend Client Tests

- [ ] **Suspend active client**
  - Click "Suspend" on an active client
  - Confirm action
  - Status badge should change to "Suspended"

- [ ] **Verify suspension effects**
  - Check clinic.isActive → false
  - Check platformClient.status → "suspended"
  - Try to log in as owner → should fail (disabled account)

- [ ] **Public booking page disabled**
  - Try to access /book/{clinicSlug}
  - Should show "Clinic not found" or inactive message

---

### Reactivate Client Tests

- [ ] **Reactivate suspended client**
  - Click "Reactivate" on suspended client
  - Status badge should change to "Active"

- [ ] **Verify reactivation effects**
  - Check clinic.isActive → true
  - Check platformClient.status → "active"
  - Owner can log in again

- [ ] **Cannot reactivate canceled client**
  - Cancel a client
  - Try to reactivate
  - Should fail or button disabled

---

### Cancel Client Tests

- [ ] **Cancel active client**
  - Click "Cancel" on active client
  - Confirm permanent action
  - Status badge should change to "Canceled"

- [ ] **Verify cancellation effects**
  - Check platformClient.status → "canceled"
  - Check platformClient.canceledAt → has timestamp
  - Check clinic.isActive → false
  - Owner cannot log in (disabled)

- [ ] **Canceled client cannot be reactivated**
  - No "Reactivate" button should show for canceled clients

---

### Reset Link Tests

- [ ] **Get reset link for existing client**
  - Click "Copy Activation Link" on any client
  - Paste in browser
  - Should show Firebase password reset page

- [ ] **Reset link updates password**
  - Use reset link to change owner password
  - Log in with new password
  - Should work

---

## Security Considerations

### Authorization Layers

1. **Middleware** (Basic Check)
   - Checks authentication only
   - Cannot access Firestore (Edge runtime limitation)
   - Redirects to login if not authenticated

2. **Frontend Page** (User Experience)
   - Checks platformAdmins collection
   - Shows/hides UI elements
   - **Can be bypassed** → not a security layer

3. **API Routes** (Actual Security)
   - Verifies Firebase ID token
   - Checks platformAdmins collection with Admin SDK
   - **Only true security layer**
   - Never trust frontend checks

### Best Practices

1. **Always verify in API routes**
   - Every API endpoint checks platformAdmins
   - Uses Firebase Admin SDK (bypasses client rules)
   - Returns 401/403 if unauthorized

2. **Firestore rules deny client access**
   - `platformClients` collection: `allow read, write: if false;`
   - All operations go through Admin SDK
   - Prevents direct client writes

3. **Audit trail**
   - `createdBy` tracks who created client
   - `lastModifiedBy` tracks who modified
   - Use for compliance and debugging

4. **Disable users on suspension**
   - Firebase Auth `.disabled = true`
   - Invalidates all existing sessions
   - User cannot log in until reactivated

---

## Troubleshooting

### "Unauthorized - Not a platform admin"

**Cause:** User's UID not in `platformAdmins` collection or `isActive=false`

**Fix:**
1. Check Firestore → `platformAdmins/{uid}`
2. Verify document exists
3. Verify `isActive === true`
4. Verify UID matches logged-in user

---

### "Failed to create client"

**Possible Causes:**
- Missing Firebase Admin SDK environment variables
- Invalid service account key
- Firestore permissions issue

**Fix:**
1. Check `.env.local` has all three env vars
2. Verify `FIREBASE_PRIVATE_KEY` includes newlines
3. Test Admin SDK: `firebase functions:config:get`
4. Check server logs for detailed error

---

### Password reset link doesn't work

**Possible Causes:**
- Incorrect `NEXT_PUBLIC_APP_URL`
- Firebase Email/Password provider not enabled
- Link expired (valid for 1 hour)

**Fix:**
1. Verify `NEXT_PUBLIC_APP_URL` matches your domain
2. Enable Email/Password in Firebase Console → Authentication
3. Generate new reset link if expired

---

### Suspended user can still log in

**Possible Causes:**
- Existing session not invalidated
- Firebase Auth cache
- Wrong user being tested

**Fix:**
1. Force logout: clear cookies/local storage
2. Wait 1-2 minutes for auth token to expire
3. Verify user.disabled === true in Firebase Console

---

### Cannot reactivate client

**Possible Causes:**
- Client status is "canceled" (cannot reactivate)
- Platform admin authorization issue

**Fix:**
1. Check client status in Firestore
2. If canceled, create new client instead
3. Only suspended clients can be reactivated

---

## Future Enhancements

### Payment Integration
- Stripe/PayPal subscription webhooks
- Automatic suspension on payment failure
- Automatic reactivation on payment success

### Analytics Dashboard
- Total revenue
- Active vs suspended vs canceled clients
- Growth metrics
- Churn rate

### Notification System
- Email owner before suspension
- Auto-reminder for expiring subscriptions
- Platform admin alerts

### Multi-Admin Support
- Role-based permissions (view-only vs full-access)
- Activity logs
- Admin audit trail

---

## Conclusion

Platform Super Admin provides comprehensive client management for the QueueWise multi-tenant system:

✅ **Secure:** Three-layer authorization (middleware, frontend, API)  
✅ **Flexible:** Suspend/reactivate/cancel workflows  
✅ **Automated:** One-click client creation with owner setup  
✅ **Auditable:** Complete trail of who created/modified what  
✅ **Production-Ready:** Built with Firebase Admin SDK  

The system is ready for production use. No Stripe integration yet (subscription fields are placeholders for future billing integration).
