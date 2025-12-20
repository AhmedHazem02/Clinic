/**
 * Date Range Utilities
 *
 * Provides consistent date range calculations for Firestore queries.
 * Used to filter bookingDate Timestamp fields with start/end of day ranges.
 */

/**
 * Get the start and end of a specific day (00:00:00 to 23:59:59.999)
 *
 * @param date - The date to get the range for (defaults to today)
 * @returns Object with start and end Date objects
 *
 * @example
 * const { start, end } = getDayRange(new Date());
 * // Query: bookingDate >= start AND bookingDate < end
 */
export function getDayRange(date: Date = new Date()): { start: Date; end: Date } {
  // Start of day (00:00:00.000)
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  // End of day (24:00:00.000 = start of next day)
  const end = new Date(date);
  end.setHours(24, 0, 0, 0); // Using 24 hours = start of next day

  return { start, end };
}

/**
 * Get today's date range in server's local timezone
 * Convenience wrapper around getDayRange()
 *
 * @returns Object with start and end Date objects for today
 *
 * @example
 * const { start, end } = getTodayRange();
 * // Use with Firestore: where("bookingDate", ">=", start).where("bookingDate", "<", end)
 */
export function getTodayRange(): { start: Date; end: Date } {
  return getDayRange(new Date());
}

/**
 * Format a date as YYYY-MM-DD string (for display purposes only)
 *
 * @param date - The date to format
 * @returns YYYY-MM-DD string
 */
export function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date falls within today's range
 *
 * @param date - The date to check
 * @returns True if the date is today
 */
export function isToday(date: Date): boolean {
  const { start, end } = getTodayRange();
  const time = date.getTime();
  return time >= start.getTime() && time < end.getTime();
}
