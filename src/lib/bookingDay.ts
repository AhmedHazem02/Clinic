/**
 * Booking Day Utilities
 * 
 * Provides canonical day string in "YYYY-MM-DD" format using Africa/Cairo timezone.
 * This is the single source of truth for day-based queue filtering.
 */

/**
 * Get the current booking day string in Africa/Cairo timezone
 * 
 * @param date - Optional date (defaults to now)
 * @returns Date string in "YYYY-MM-DD" format (Cairo time)
 * 
 * @example
 * getCairoBookingDay() // "2025-12-19"
 * getCairoBookingDay(new Date("2025-12-19T23:00:00Z")) // "2025-12-20" (Cairo is UTC+2)
 */
export function getCairoBookingDay(date?: Date): string {
  const d = date ?? new Date();
  
  // Use Intl.DateTimeFormat with Africa/Cairo timezone to get local parts
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
}

/**
 * Check if a booking day string is today (Cairo time)
 * 
 * @param bookingDay - Booking day string ("YYYY-MM-DD")
 * @returns true if the booking day is today in Cairo timezone
 */
export function isBookingDayToday(bookingDay: string): boolean {
  return bookingDay === getCairoBookingDay();
}

/**
 * Get yesterday's booking day (Cairo time)
 * Useful for testing/debugging
 */
export function getYesterdayBookingDay(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getCairoBookingDay(yesterday);
}

/**
 * Get tomorrow's booking day (Cairo time)
 * Useful for testing/debugging
 */
export function getTomorrowBookingDay(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getCairoBookingDay(tomorrow);
}
