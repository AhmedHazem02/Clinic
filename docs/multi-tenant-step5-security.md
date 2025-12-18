# Step 5: Security Hardening & Production Readiness

## Overview

Step 5 implements comprehensive security hardening to protect patient data and prevent unauthorized access in production. This includes:

1. **Server-side booking API** to prevent public Firestore writes
2. **QueueState collection** for anti-scraping status pages
3. **Strict Firestore security rules** with multi-tenant isolation
4. **Get-only public access** (no list queries to prevent data scraping)

---

## Security Architecture

### Before Step 5 (Insecure)
```
Public Booking Page
   ↓ (Direct Write)
Firestore patients collection
   ↑ (List Query)
Public Status Page
```
**Problems:**
- Public users can write to Firestore directly
- Status page uses list queries (scrapable)
- No multi-tenant isolation in rules

### After Step 5 (Secure)
```
Public Booking Page
   ↓ (HTTP POST)
Server API (/api/public/book)
   ↓ (Admin SDK)
Firestore (bypasses rules)
   ↑ (Get-only)
Public Status Page (reads bookingTickets + queueState)
```
**Benefits:**
- No public writes to Firestore
- Anti-scraping: get-only access
- Server validates all data
- Multi-tenant isolation enforced

---

## Implementation Details

### 1. Server-Side Booking API

**File:** `src/app/api/public/book/route.ts`

**What it does:**
- Receives booking requests from public booking page
- Validates clinic and doctor exist and are active
- Checks for duplicate bookings (same day)
- Generates queue numbers (MAX + 1)
- Creates patient + bookingTicket atomically using Admin SDK
- Returns ticketId for status page redirect

**Environment Variables Required:**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**API Contract:**
```typescript
// POST /api/public/book
Request: {
  clinicId: string;
  doctorId: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  consultationReason?: string;
  chronicDiseases?: string;
  queueType: 'Consultation' | 'Re-consultation';
}

Response (Success): {
  ok: true;
  ticketId: string;
  queueNumber: number;
}

Response (Duplicate): {
  ok: false;
  error: 'Patient already has an active booking today';
  existingTicketId: string;
}

Response (Error): {
  ok: false;
  error: string;
}
```

---

### 2. QueueState Collection

**Purpose:** Enable status pages to calculate "people ahead" without list queries.

**Schema:**
```typescript
interface QueueState {
  clinicId: string;
  doctorId: string;
  currentConsultingQueueNumber: number | null;
  isOpen: boolean;
  updatedAt: Timestamp;
}
```

**Document ID Format:** `{clinicId}_{doctorId}`

**How it works:**
1. When a patient status becomes "Consulting", `queueService` updates `queueState`
2. Status page listens to single document: `queueState/{clinicId}_{doctorId}`
3. Calculate people ahead: `ticket.queueNumber - queueState.currentConsultingQueueNumber - 1`
4. **No list queries needed** → Anti-scraping protection

**Modified Functions:**
- `updatePatientStatus()` - Updates queueState when status → 'Consulting'
- `finishAndCallNext()` - Updates queueState to next patient

---

### 3. Firestore Security Rules

**File:** `firestore.rules`

#### Key Principles

1. **Default deny all**
   ```javascript
   match /{document=**} {
     allow read, write: if false;
   }
   ```

2. **Public get-only access** (no list queries)
   ```javascript
   // ✅ Allow: Get single document
   allow get: if resource.data.isActive == true;
   
   // ❌ Deny: List queries
   allow list: if false;
   ```

3. **Multi-tenant isolation**
   ```javascript
   function sameClinic(clinicId) {
     return isAuthenticated() && (
       (exists(/databases/$(database)/documents/doctors/$(request.auth.uid)) && 
        getUserClinicId() == clinicId) ||
       (exists(/databases/$(database)/documents/nurses/$(request.auth.uid)) && 
        getNurseClinicId() == clinicId)
     );
   }
   ```

#### Collection-by-Collection Rules

| Collection | Public Get | Public List | Public Write | Staff Access |
|-----------|-----------|------------|-------------|-------------|
| `clinics` | ✅ (if active) | ❌ | ❌ | ✅ (own clinic) |
| `doctors` | ✅ (if active) | ❌ | ❌ | ✅ (own profile + clinic) |
| `nurses` | ❌ | ❌ | ❌ | ✅ (own profile + clinic) |
| `patients` | ❌ | ❌ | ❌ | ✅ (own clinic only) |
| `bookingTickets` | ✅ (if not expired) | ❌ | ❌ | ✅ (own clinic) |
| `queueState` | ✅ | ❌ | ❌ | ✅ (own clinic) |
| `invites` | ❌ | ❌ | ❌ | ✅ (own clinic) |
| `userProfiles` | ❌ | ❌ | ❌ | ✅ (own profile) |

---

### 4. Status Page Refactoring

**File:** `src/app/status/[clinicId]/[doctorId]/[ticketId]/page.tsx`

**Changes:**
- ❌ **Removed:** List query to count waiting patients
- ✅ **Added:** Listen to single `queueState` document
- ✅ **Added:** Calculate people ahead from `queueState.currentConsultingQueueNumber`

**Security Benefits:**
- Cannot scrape all tickets via list queries
- Can only access tickets you have the ID for
- queueState exposed but contains no PII

---

### 5. Booking Page Refactoring

**File:** `src/app/book/[clinicSlug]/page.tsx`

**Changes:**
- ❌ **Removed:** Direct call to `addPatientToQueue()`
- ✅ **Added:** HTTP POST to `/api/public/book`
- ✅ **Added:** Error handling for duplicate bookings

---

## Manual Testing Checklist

### Public Booking Flow
- [ ] Navigate to `/book/{clinicSlug}`
- [ ] Fill form with valid phone number (01XXXXXXXXX)
- [ ] Select a doctor
- [ ] Submit form
- [ ] Verify redirect to `/book/{clinicSlug}/success?ticketId=...`
- [ ] Verify success page shows QR code and status link
- [ ] Click status link
- [ ] Verify status page shows queue number and "people ahead"

### Duplicate Booking Prevention
- [ ] Try to book again with same phone number
- [ ] Verify redirect to existing ticket status page
- [ ] Verify toast message: "لديك حجز بالفعل"

### Status Page Real-Time Updates
- [ ] Open status page
- [ ] In another tab, log in as doctor
- [ ] Change patient status to "Consulting"
- [ ] Verify status page updates immediately
- [ ] Verify "people ahead" count decreases

### Security Validation
- [ ] Deploy firestore.rules to Firebase Console
- [ ] Try to write to `patients` collection from browser console → Should fail
- [ ] Try to list `bookingTickets` from browser console → Should fail
- [ ] Try to get single `bookingTickets/{ticketId}` → Should succeed

---

## Environment Setup for Production

### Firebase Admin SDK Setup

1. **Generate Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save JSON file securely

2. **Extract Environment Variables:**
   ```bash
   {
     "project_id": "your-project-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk@your-project.iam.gserviceaccount.com"
   }
   ```

3. **Add to `.env.local`:**
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. **Deploy to Vercel/Production:**
   - Add same environment variables to Vercel/hosting platform
   - **Important:** Keep `FIREBASE_PRIVATE_KEY` secret and quoted

---

## Deployment Steps

1. **Deploy Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Deploy Next.js App:**
   ```bash
   npm run build
   vercel --prod
   ```

3. **Verify Environment Variables:**
   - Check Vercel dashboard → Project → Settings → Environment Variables
   - Ensure all three Firebase Admin SDK variables are set

4. **Test Production:**
   - Try public booking
   - Try status page
   - Verify no console errors

---

## Security Improvements Summary

| Security Concern | Before Step 5 | After Step 5 |
|-----------------|---------------|-------------|
| Public Firestore Writes | ✅ Possible | ❌ Blocked |
| Data Scraping via List Queries | ✅ Possible | ❌ Blocked (get-only) |
| Multi-Tenant Isolation | ❌ Missing | ✅ Enforced |
| PII Exposure in Status Page | ⚠️ Possible | ✅ Protected |
| Server-Side Validation | ❌ Missing | ✅ Implemented |
| Admin SDK for Trusted Ops | ❌ Not used | ✅ Used |

---

## Files Created/Modified in Step 5

### Created
- `src/app/api/public/book/route.ts` - Server-side booking API
- `src/services/queueStateService.ts` - Queue state management
- `docs/multi-tenant-step5-security.md` - This documentation

### Modified
- `firestore.rules` - Comprehensive security rules
- `src/app/book/[clinicSlug]/page.tsx` - Call server API
- `src/app/status/[clinicId]/[doctorId]/[ticketId]/page.tsx` - Use queueState
- `src/services/queueService.ts` - Maintain queueState on status changes
- `src/types/multitenant.ts` - Added QueueState interface
- `src/lib/firebaseAdmin.ts` - Added adminDb and adminApp exports

---

## Next Steps (Step 6 - Future)

Potential future enhancements:
1. Rate limiting on booking API (prevent spam)
2. SMS notifications for queue status
3. Admin dashboard for monitoring (analytics)
4. Audit logs for sensitive operations
5. Two-factor authentication for staff
6. Automated backup and disaster recovery

---

## Troubleshooting

### "Booking failed" error
- Check server logs: `vercel logs` or check Vercel dashboard
- Verify Firebase Admin SDK env vars are set correctly
- Ensure service account has Firestore permissions

### Status page shows 0 people ahead (wrong)
- Check if queueState document exists: `queueState/{clinicId}_{doctorId}`
- Verify queueService is calling `updateQueueState()` on status changes
- Check browser console for errors

### Public users can still write to Firestore
- Verify firestore.rules deployed: `firebase deploy --only firestore:rules`
- Check Firebase Console → Firestore → Rules tab
- Test in Firebase Console → Rules Playground

### "Permission denied" for staff operations
- Check user is authenticated: `request.auth != null`
- Verify user's clinicId matches resource clinicId
- Check helper functions (sameClinic, isDoctor, isNurse)

---

## Conclusion

Step 5 successfully hardens security for production deployment:
- ✅ Public users cannot write to Firestore
- ✅ Status page cannot be scraped via list queries
- ✅ Multi-tenant isolation prevents cross-clinic data access
- ✅ Server-side validation ensures data integrity
- ✅ Privacy-safe design minimizes PII exposure

**Build Status:** ✅ Passing  
**Security Level:** 🔒 Production-ready  
**Next:** Deploy to production and monitor logs
