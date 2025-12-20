# BookingDay Implementation Summary

## Overview
Implemented canonical `bookingDay` field (Cairo timezone) for accurate day-based queue filtering and cross-midnight data consistency.

## Changes Made

### 1. Created bookingDay Helper (`src/lib/bookingDay.ts`)
- `getCairoBookingDay()` - Returns "YYYY-MM-DD" string in Africa/Cairo timezone
- `isBookingDayToday()` - Checks if a bookingDay is today (Cairo)
- `getYesterdayBookingDay()` - Returns yesterday's bookingDay

### 2. Updated Patient Document Creation
**Files Modified:**
- `src/services/queueService.ts` - `addPatientToQueue()` now writes `bookingDay` field
- `src/app/api/public/book/route.ts` - Public booking API writes `bookingDay` field

**New Field:**
```typescript
bookingDay: string // "YYYY-MM-DD" format (Africa/Cairo timezone)
```

### 3. Updated Queue Queries to Use bookingDay

#### Queue Count API (`src/app/api/public/queue-count/route.ts`)
- **Before:** Used `bookingDate >= startTimestamp AND bookingDate < endTimestamp`
- **After:** Uses `bookingDay == "YYYY-MM-DD"`
- **Benefit:** Simpler queries, no Timestamp range calculations
- **Backward Compatibility:** Falls back to Timestamp range for old documents without `bookingDay`

#### Nurse Dashboard Listener (`src/services/queueService.ts`)
- **Function:** `listenToClinicQueue()`
- **Before:** Filtered by `bookingDate` Timestamp range
- **After:** Filters by `bookingDay == today`
- **Benefit:** Consistent Cairo timezone, no edge cases at midnight

### 4. Restored queueState Updates
**Modified Functions:**
- `updatePatientStatus()` - Updates queueState when patient becomes "Consulting"
- `finishAndCallNext()` - Updates queueState with next consulting patient's queue number

**Reason:** Patient status page (`/status/[clinicId]/[doctorId]/[ticketId]`) relies on queueState for real-time "people ahead" calculation without list queries.

### 5. Cleaned Up Unused Code
- **Deleted:** `src/app/api/public/queue-preview/` (replaced by queue-count)
- **Removed:** `updateMaxQueueNumber()` from queueStateService (unused)

## Backward Compatibility

### For Documents Without bookingDay
All query implementations include fallback logic:
```typescript
// Primary query: Use bookingDay
const snapshot = await query(...where('bookingDay', '==', today))

// Fallback: Use bookingDate range for old documents
if (snapshot.empty) {
  const { start, end } = getTodayRange()
  const fallbackSnapshot = await query(
    ...where('bookingDate', '>=', Timestamp.fromDate(start)),
    ...where('bookingDate', '<', Timestamp.fromDate(end))
  )
  // Only count docs without bookingDay field
}
```

### Gradual Migration
- **New patients:** Always have `bookingDay` field
- **Old patients:** Continue to work with `bookingDate` Timestamp
- **No data loss:** All existing documents remain functional

## Data Model

### Patient Document (Updated)
```typescript
{
  name: string
  phone: string
  bookingDate: Timestamp        // Legacy field (kept for compatibility)
  bookingDay: string            // NEW: "YYYY-MM-DD" (Africa/Cairo)
  age: number | null
  chronicDiseases: string | null
  consultationReason: string | null
  queueType: "Consultation" | "Re-consultation"
  queueNumber: number
  status: "Waiting" | "Consulting" | "Finished"
  doctorId: string
  clinicId: string
  source: "patient" | "nurse"
  ticketId?: string
  createdAt: Timestamp
}
```

### BookingDay vs BookingDate
| Field | Type | Timezone | Usage | Index |
|-------|------|----------|-------|-------|
| `bookingDate` | Timestamp | UTC | Legacy, backward compatibility | ✅ Composite |
| `bookingDay` | string | Africa/Cairo | Primary filter, canonical day | ⚠️ **NEEDS INDEX** |

## Required Firestore Index

**CRITICAL:** Add this composite index to Firestore:

```
Collection: patients
Fields:
  - clinicId (Ascending)
  - doctorId (Ascending)  
  - bookingDay (Ascending)
  - status (Ascending)
```

**Why:** Query uses 4 fields with equality filters:
```typescript
where('clinicId', '==', clinicId)
where('doctorId', '==', doctorId)
where('bookingDay', '==', today)
where('status', 'in', ['Waiting', 'Consulting'])
```

## Testing Checklist

### Nurse Dashboard
- [ ] New patients added show up immediately
- [ ] Only TODAY's patients visible (not yesterday/tomorrow)
- [ ] Doctor filter works correctly
- [ ] Queue numbers accurate per doctor
- [ ] Real-time updates work

### Booking Page
- [ ] Queue count accurate before booking
- [ ] Count updates immediately after booking
- [ ] Cross-doctor counts independent
- [ ] Midnight rollover: count resets to 0

### Patient Status Page
- [ ] "People ahead" count accurate
- [ ] Updates in real-time when doctor calls next patient
- [ ] Works for both new (bookingDay) and old (bookingDate) bookings

### Doctor Dashboard  
- [ ] Calling next patient updates queueState
- [ ] Finishing patient doesn't break status page
- [ ] Queue numbers sequential and accurate

## Timezone Behavior

### Cairo Timezone (Africa/Cairo = UTC+2)
- **Spring/Summer:** No DST (Egypt abolished DST in 2014)
- **Year-round:** Consistent UTC+2 offset
- **Midnight:** Day boundaries occur at Cairo midnight, not UTC midnight

### Example: Day Boundary
```
UTC Time:         2024-03-15 21:59:59 → 2024-03-15 22:00:00
Cairo Time:       2024-03-15 23:59:59 → 2024-03-16 00:00:00
bookingDay:       "2024-03-15"       → "2024-03-16"
```

**Result:** New patients after Cairo midnight get tomorrow's bookingDay, automatically filtered out from today's queue.

## Build Status
✅ **Build passes successfully**
- Route count: 35 (down from 36, removed queue-preview)
- No TypeScript errors
- Warnings: Unrelated genkit dependencies (pre-existing)

## Migration Notes

### For Future Data Cleanup (Optional)
To backfill old documents with `bookingDay`:
```javascript
// Run once as admin script
const patients = await db.collection('patients')
  .where('bookingDay', '==', null)
  .get()

for (const doc of patients.docs) {
  const bookingDate = doc.data().bookingDate.toDate()
  const bookingDay = getCairoBookingDay(bookingDate)
  await doc.ref.update({ bookingDay })
}
```

### Performance Impact
- **Positive:** String equality faster than Timestamp range queries
- **Positive:** Simpler query plans, fewer index lookups
- **Neutral:** Minimal storage increase (11 bytes per document)
- **Note:** Requires new Firestore composite index

## References
- Original discussion: Multi-tenant day-based queue refactoring
- Timezone helper: `src/lib/bookingDay.ts`
- Queue service: `src/services/queueService.ts`
- Firestore rules: `firestore.rules` (supports legacy + modern data)
