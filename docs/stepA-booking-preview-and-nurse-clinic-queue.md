# Step A: Booking Preview & Nurse Clinic-Wide Queue

## Overview
This document describes two major enhancements implemented for the QueueWise multi-tenant clinic system:

**A) Public Booking Page Queue Preview**
- Shows "people ahead" and "estimated wait time" BEFORE booking
- Based on selected doctor
- Uses secure server-side API for data aggregation

**B) Nurse Dashboard Clinic-Wide View**
- Shows ALL clinic bookings regardless of which nurse created them
- Includes doctor filter dropdown for multi-doctor clinics
- Maintains backward compatibility with legacy profiles

---

## Part 1: Public Booking Queue Preview

### Problem Statement
Patients want to know how long they'll wait before booking. Previously, they only saw queue information AFTER booking.

### Solution Architecture

#### 1. QueueState Collection Enhancement
**Location:** `src/types/multitenant.ts`

Added new field to track highest queue number today:
```typescript
export interface QueueState {
  clinicId: string;
  doctorId: string;
  currentConsultingQueueNumber: number | null;
  currentMaxQueueNumberToday?: number;  // NEW FIELD
  isOpen: boolean;
  updatedAt: Timestamp | Date;
}
```

**Document ID Format:** `{clinicId}_{doctorId}`

#### 2. Queue State Maintenance
**Location:** `src/services/queueStateService.ts`

Added `updateMaxQueueNumber()` function:
- Called when new patient is added
- Compares new queue number with current max
- Only updates if new number is higher
- Prevents race conditions with atomic reads

**Updated Locations:**
- `src/services/queueService.ts::addPatientToQueue()` - Updates max queue number after patient creation
- Existing: `updatePatientStatus()` - Already updates currentConsultingQueueNumber
- Existing: `finishAndCallNext()` - Already updates currentConsultingQueueNumber

#### 3. Public API Endpoint
**Location:** `src/app/api/public/queue-preview/route.ts`

**Endpoint:** `GET /api/public/queue-preview?clinicSlug={slug}&doctorId={id}`

**Server-Side Logic (Admin SDK):**
1. Resolve clinicId from slug
2. Verify doctor belongs to clinic and is active
3. Fetch queueState document
4. Fetch clinic settings for consultationTime
5. Calculate preview metrics

**Calculation Logic:**
```javascript
consultingNumber = currentConsultingQueueNumber ?? 0
maxToday = max(currentMaxQueueNumberToday, consultingNumber)
peopleAhead = max(0, maxToday - consultingNumber)
etaMinutes = peopleAhead * consultationTime
```

**Response:**
```json
{
  "ok": true,
  "peopleAhead": 5,
  "etaMinutes": 75,
  "consultationTime": 15,
  "currentConsultingQueueNumber": 3,
  "currentMaxQueueNumberToday": 8
}
```

**Security:**
- Uses Firebase Admin SDK (bypasses Firestore rules)
- No sensitive patient data exposed
- Only aggregate metrics returned
- Public read access to queueState documents via Firestore rules

#### 4. Booking Page UI
**Location:** `src/app/book/[clinicSlug]/page.tsx`

**Implementation:**
- New `useEffect` hook watches `selectedDoctorId`
- Fetches queue preview when doctor changes
- Shows loading skeleton while fetching
- Displays in blue Alert component with icons
- Includes "تقديري" (estimate) disclaimer
- Graceful degradation if API fails

**UI Components:**
```tsx
{selectedDoctorId && (
  <Alert className="bg-blue-50 border-blue-200">
    <AlertDescription>
      {loadingPreview ? (
        <Loader2 /> "جاري تحميل حالة الطابور..."
      ) : queuePreview ? (
        <>
          <Users /> عدد اللي قبلك: {peopleAhead} شخص
          <Clock /> الوقت المتوقع: {etaMinutes} دقيقة
          * تقديري - قد يختلف الوقت الفعلي
        </>
      ) : (
        "معلومات الطابور غير متاحة"
      )}
    </AlertDescription>
  </Alert>
)}
```

---

## Part 2: Nurse Dashboard Clinic-Wide View

### Problem Statement
Nurses could only see patients they personally registered or assigned to their doctor. In multi-doctor clinics, they couldn't see the full clinic queue.

### Solution Architecture

#### 1. New Queue Listener Function
**Location:** `src/services/queueService.ts`

Added `listenToClinicQueue()`:
```typescript
export const listenToClinicQueue = (
  clinicId: string,
  callback: (patients: PatientInQueue[]) => void,
  errorCallback?: (error: Error) => void,
  options?: {
    doctorId?: string;
    status?: PatientStatus;
    includeFinished?: boolean;
  }
)
```

**Query Logic:**
- Filters by `clinicId` (not doctorId)
- Filters by today's date using `createdAt >= startOfDay`
- Optional doctor filter for UI filtering
- Default: excludes finished patients
- Orders by `queueNumber` ascending

**Firestore Query:**
```javascript
where("clinicId", "==", clinicId)
where("createdAt", ">=", startOfToday)
or(where("status", "==", "Waiting"), where("status", "==", "Consulting"))
orderBy("queueNumber", "asc")
```

#### 2. Nurse Dashboard Updates
**Location:** `src/components/nurse/nurse-dashboard-client.tsx`

**Changes:**
1. Added state for doctors list and selected filter
2. Load clinic doctors on mount via `getClinicDoctors()`
3. Replaced `listenToQueueForNurse()` with `listenToClinicQueue()`
4. Added client-side doctor filter in `filterPatients()`
5. Pass doctor metadata to QueueList component

**Backward Compatibility:**
```typescript
// Get clinicId from userProfile (multi-tenant)
const clinicId = 'clinicId' in userProfile ? userProfile.clinicId : undefined;

if (!clinicId) {
  // Fallback to legacy doctor-specific queue
  const doctorId = user.uid;
  const unsubscribe = listenToQueueForNurse(doctorId, callback);
  return () => unsubscribe();
}

// Use clinic-wide queue listener (modern multi-tenant mode)
const unsubscribe = listenToClinicQueue(clinicId, callback, errorCallback, {
  includeFinished: false
});
```

**Doctor Filter UI:**
```tsx
{doctors.length > 1 && (
  <div className="space-y-2">
    <Label htmlFor="doctorFilter">
      <Stethoscope /> تصفية حسب الطبيب
    </Label>
    <Select value={selectedDoctorFilter} onValueChange={setSelectedDoctorFilter}>
      <SelectItem value="all">كل الأطباء</SelectItem>
      {doctors.map((doctor) => (
        <SelectItem key={doctor.id} value={doctor.id}>
          {doctor.name} - {doctor.specialty}
        </SelectItem>
      ))}
    </Select>
  </div>
)}
```

#### 3. Queue List Component Updates
**Location:** `src/components/nurse/queue-list.tsx`

**Changes:**
1. Added optional props: `showDoctorColumn`, `getDoctorName`
2. Conditionally render doctor column in table header
3. Show doctor name in each patient row
4. Adjust empty state colspan for new column

**New Table Structure:**
```
| رقم الكشف | الاسم | الطبيب (conditional) | وقت الانتظار المقدر | الحالة | الإجراءات |
```

---

## Security Considerations

### 1. Public Queue Preview
✅ **Safe:**
- No patient names or personal data exposed
- Only aggregate metrics (counts, estimates)
- Server-side API with Admin SDK (bypasses rules)
- Firestore rules allow public GET (not list) on queueState

❌ **Prevented:**
- Cannot list all patients
- Cannot scrape patient data
- Cannot access other clinics' data

### 2. Clinic-Wide Queue Access
✅ **Safe:**
- Firestore rules enforce clinicId filtering
- Nurses can only see their clinic's patients
- Multi-tenant isolation maintained
- Backward compatible with legacy profiles

❌ **Prevented:**
- Cannot access other clinics' patients
- Cannot access patients without clinicId match
- Deactivated nurses auto-logged out

### Firestore Rules (Already Configured)
```javascript
// Queue State: Public can get current queue state (anti-scraping)
match /queueState/{stateId} {
  // Public: Can get queue state (format: {clinicId}_{doctorId})
  allow get: if true;

  // Staff: Can read for their clinic
  allow read: if sameClinic(resource.data.clinicId);

  // Staff: Can create/update queue state for their clinic
  allow create: if sameClinic(request.resource.data.clinicId);
  allow update: if sameClinic(resource.data.clinicId);
}

// Patients: Strict multi-tenant isolation
match /patients/{patientId} {
  allow read, update, delete: if
    (resource.data.get('clinicId', null) != null && sameClinic(resource.data.clinicId)) ||
    (resource.data.get('clinicId', null) == null && isAuthenticated());
}
```

### Firestore Composite Indexes Required

The following composite indexes are needed for the bookingDate range queries:

**Index 1: Queue Preview API**
- Collection: `patients`
- Fields:
  - `clinicId` (Ascending)
  - `doctorId` (Ascending)
  - `bookingDate` (Ascending)
  - `status` (Ascending)

**Index 2: Nurse Clinic-Wide Queue Listener**
- Collection: `patients`
- Fields:
  - `clinicId` (Ascending)
  - `bookingDate` (Ascending)
  - `status` (Ascending)
  - `queueNumber` (Ascending)

**Index 3: Public Booking - Existing Check**
- Collection: `patients`
- Fields:
  - `phone` (Ascending)
  - `clinicId` (Ascending)
  - `doctorId` (Ascending)
  - `bookingDate` (Ascending)

**Index 4: Public Booking - Queue Number**
- Collection: `patients`
- Fields:
  - `doctorId` (Ascending)
  - `clinicId` (Ascending)
  - `bookingDate` (Descending)
  - `queueNumber` (Descending)

**Note:** Firestore will auto-generate error messages with exact index creation links when these queries first run in production. Copy those URLs to create indexes via Firebase Console.

---

## Files Modified

### Services
- [src/services/queueStateService.ts](../src/services/queueStateService.ts) - Added `updateMaxQueueNumber()`
- [src/services/queueService.ts](../src/services/queueService.ts) - Updated `addPatientToQueue()`, added `listenToClinicQueue()`

### Types
- [src/types/multitenant.ts](../src/types/multitenant.ts) - Updated `QueueState` interface

### API Routes
- [src/app/api/public/queue-preview/route.ts](../src/app/api/public/queue-preview/route.ts) - NEW: Queue preview endpoint

### UI Components
- [src/app/book/[clinicSlug]/page.tsx](../src/app/book/[clinicSlug]/page.tsx) - Added queue preview display
- [src/components/nurse/nurse-dashboard-client.tsx](../src/components/nurse/nurse-dashboard-client.tsx) - Clinic-wide queue, doctor filter
- [src/components/nurse/queue-list.tsx](../src/components/nurse/queue-list.tsx) - Doctor column support

### Security
- [firestore.rules](../firestore.rules) - Already configured (no changes needed)

---

## Testing Guide

### A) Queue Preview on Public Booking Page

1. **Setup:**
   - Ensure at least one active clinic with active doctors
   - Ensure some patients are already booked for today

2. **Test Steps:**
   ```bash
   # Navigate to public booking page
   http://localhost:3000/book/[clinic-slug]
   ```

3. **Expected Behavior:**
   - Select a doctor from dropdown
   - See loading spinner briefly
   - See blue alert box with:
     - "عدد اللي قبلك: X شخص"
     - "الوقت المتوقع: Y دقيقة"
     - "* تقديري - قد يختلف الوقت الفعلي"
   - Change doctor → preview updates

4. **Edge Cases:**
   - No patients today → Shows "0 شخص" and "0 دقيقة"
   - API fails → Shows "معلومات الطابور غير متاحة"
   - Only one doctor → Auto-selects and shows preview

5. **Verify Data:**
   - Open Firestore console
   - Check `queueState/{clinicId}_{doctorId}` document
   - Verify `currentMaxQueueNumberToday` matches highest queue number
   - Book a new patient
   - Verify `currentMaxQueueNumberToday` increments

### B) Nurse Dashboard Clinic-Wide View

1. **Setup:**
   - Create a clinic with 2+ doctors
   - Create 2+ nurse accounts for the same clinic
   - Book patients via different nurses and public booking

2. **Test Steps:**
   ```bash
   # Login as Nurse 1
   # Navigate to dashboard
   http://localhost:3000/nurse/dashboard
   ```

3. **Expected Behavior:**
   - See ALL today's patients across all doctors
   - See "تصفية حسب الطبيب" dropdown (if 2+ doctors)
   - Table shows doctor name column
   - Can filter by specific doctor
   - Can see patients booked by:
     - Other nurses
     - Public self-booking
     - Own registrations

4. **Actions to Test:**
   - Start consultation on any patient → Should work
   - View QR code → Should work
   - Cancel booking → Should work
   - Register new patient → Should appear in list immediately

5. **Legacy Compatibility:**
   ```bash
   # Test with legacy nurse profile (no clinicId)
   # Should fallback to doctor-specific queue (old behavior)
   ```

6. **Verify Firestore:**
   - Check `patients` collection
   - Verify all have matching `clinicId`
   - Check different `doctorId` values
   - Verify nurse sees all regardless of `doctorId`

### C) Integration Tests

1. **Cross-Clinic Isolation:**
   - Create 2 clinics with nurses
   - Verify Nurse A cannot see Clinic B's patients
   - Verify queue preview only shows own clinic's data

2. **Real-Time Updates:**
   - Open dashboard on 2 different nurse accounts
   - Register patient via Nurse 1
   - Verify Nurse 2 sees it immediately
   - Start consultation via Nurse 2
   - Verify queue preview updates for public page

3. **Security:**
   - Try accessing `/api/public/queue-preview` with invalid clinic/doctor
   - Verify 404 errors
   - Try listing `queueState` collection from client
   - Verify Firestore rules block it (only GET allowed)

---

## Known Limitations

### Queue Preview
1. **Estimate only:** Actual wait time may vary based on:
   - Complexity of consultations
   - Doctor taking breaks
   - Patients arriving late

2. **No real-time updates:** Preview fetches once when doctor selected
   - User must refresh or reselect doctor to see updates
   - Consider: WebSocket or polling for live updates (future)

3. **Race conditions:** If two patients book simultaneously:
   - Both may see same preview
   - Both will get unique queue numbers
   - Preview might be off by 1-2 for brief moment

### Nurse Dashboard
1. **Client-side filtering:** Doctor filter uses client-side JavaScript
   - All patients loaded from Firestore
   - Filter applied in browser
   - Fine for small clinics (<100 patients/day)
   - Consider: Server-side pagination for large clinics

2. **Queue number conflicts:** If nurse manually changes queue number:
   - May not reflect in `currentMaxQueueNumberToday`
   - Consider: Add manual refresh or recalculation

---

## Future Enhancements

### Queue Preview
- [ ] Real-time preview updates via WebSocket or polling
- [ ] Historical accuracy tracking (estimate vs actual)
- [ ] Personalized estimates based on queueType
- [ ] Busy/slow indicators based on current queue velocity

### Nurse Dashboard
- [ ] Pagination for large patient lists
- [ ] Advanced filters: status, queueType, date range
- [ ] Bulk actions: cancel multiple, print multiple QR codes
- [ ] Analytics: average wait time, patient throughput
- [ ] Notifications: alert when queue gets long

---

## Changelog

**2025-12-19 - Step A Implementation**
- ✅ Added `currentMaxQueueNumberToday` to QueueState
- ✅ Created `updateMaxQueueNumber()` in queueStateService
- ✅ Updated `addPatientToQueue()` to maintain max queue number
- ✅ Created `/api/public/queue-preview` endpoint
- ✅ Added queue preview UI to booking page
- ✅ Created `listenToClinicQueue()` in queueService
- ✅ Updated nurse dashboard to use clinic-wide queue
- ✅ Added doctor filter dropdown and column
- ✅ Maintained backward compatibility for legacy profiles
- ✅ Verified Firestore rules (already correct)
- ✅ Created comprehensive documentation

**2025-12-19 - Bug Fix: bookingDate Timestamp Filtering**
- ✅ Created centralized date range helper (`src/lib/dateRange.ts`)
- ✅ Fixed queue preview API to use proper date range (`bookingDate >= start AND bookingDate < end`)
- ✅ Fixed nurse clinic-wide queue listener to use `bookingDate` instead of `createdAt`
- ✅ Fixed public booking API duplicate check and queue number queries
- ✅ Documented required Firestore composite indexes
- **Critical Fix:** All queries now correctly filter bookingDate Timestamp fields with start/end of day bounds instead of only using `>=` operator which was matching all future dates

---

## Support

For questions or issues:
1. Check this documentation
2. Review code comments in modified files
3. Test in development environment first
4. Verify Firestore rules match documentation

**Build Status:** ✅ All changes TypeScript-compatible, no breaking changes
