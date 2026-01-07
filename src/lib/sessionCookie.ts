/**
 * Session Cookie Service
 * 
 * Manages session cookies for middleware authentication.
 * Works alongside Firebase Auth to enable server-side auth checks.
 * 
 * Usage:
 * 1. After Firebase login, call setSessionCookie()
 * 2. Before Firebase logout, call clearSessionCookie()
 * 3. Middleware checks for cookie presence to gate protected routes
 */

const SESSION_COOKIE_NAME = '__session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Set session cookie after successful Firebase authentication
 * This should be called after onAuthStateChanged confirms user is logged in
 * 
 * @param userId - Firebase user UID
 */
export function setSessionCookie(userId: string): void {
  if (typeof document === 'undefined') return;
  
  // Create a simple session token (in production, use a proper JWT or session token)
  const sessionValue = btoa(JSON.stringify({
    uid: userId,
    timestamp: Date.now(),
  }));
  
  // Set cookie with security flags
  document.cookie = [
    `${SESSION_COOKIE_NAME}=${sessionValue}`,
    `max-age=${SESSION_COOKIE_MAX_AGE}`,
    'path=/',
    'SameSite=Lax',
    // Add 'Secure' flag in production
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');
}

/**
 * Clear session cookie on logout
 * This should be called before Firebase signOut
 */
export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = [
    `${SESSION_COOKIE_NAME}=`,
    'max-age=0',
    'path=/',
    'SameSite=Lax',
  ].join('; ');
}

/**
 * Check if session cookie exists (client-side)
 * 
 * @returns true if session cookie exists
 */
export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  
  return document.cookie
    .split(';')
    .some(cookie => cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
}

/**
 * Get session data from cookie (client-side)
 * 
 * @returns Session data or null if not found/invalid
 */
export function getSessionData(): { uid: string; timestamp: number } | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const sessionCookie = cookies.find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  
  if (!sessionCookie) return null;
  
  try {
    const value = sessionCookie.split('=')[1];
    return JSON.parse(atob(value));
  } catch {
    return null;
  }
}

/**
 * Refresh session cookie timestamp
 * Call this periodically to extend session
 * 
 * @param userId - Firebase user UID
 */
export function refreshSessionCookie(userId: string): void {
  setSessionCookie(userId);
}
