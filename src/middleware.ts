/**
 * Next.js Middleware
 * 
 * Provides:
 * 1. Security headers for all responses
 * 2. Protected route handling (redirects to login)
 * 3. Rate limiting headers
 * 4. CORS handling for API routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  '/admin',
  '/doctor',
  '/nurse',
  '/platform',
];

/** Public routes that don't need authentication */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/platform/login',  // Platform admin login page
  '/book',
  '/status',
  '/accept-invite',
  '/api/public',
];

/** API routes that should have CORS headers */
const API_ROUTES = ['/api'];

// =============================================================================
// Security Headers
// =============================================================================

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (disable sensitive features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // Content Security Policy (adjust as needed)
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com",
      "frame-src 'self' https://*.firebaseapp.com",
    ].join('; ')
  );
  
  return response;
}

// =============================================================================
// Route Helpers
// =============================================================================

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api');
}

function getLoginRedirectUrl(pathname: string): string {
  // Different login pages for different sections
  if (pathname.startsWith('/platform')) {
    return '/platform/login';
  }
  return '/login';
}

// =============================================================================
// Session Cookie Helpers
// =============================================================================

const SESSION_COOKIE_NAME = '__session';

function hasSessionCookie(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  return !!sessionCookie?.value;
}

// =============================================================================
// CORS Handling
// =============================================================================

function handleCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  
  // Allow requests from same origin or no origin (same-site requests)
  if (!origin) {
    return response;
  }
  
  // For public API routes, allow specific origins
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:9002',
  ].filter(Boolean);
  
  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  
  return response;
}

// =============================================================================
// Main Middleware
// =============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return handleCors(request, addSecurityHeaders(response));
  }
  
  // Create response
  let response = NextResponse.next();
  
  // Add security headers to all responses
  response = addSecurityHeaders(response);
  
  // Handle CORS for API routes
  if (isApiRoute(pathname)) {
    response = handleCors(request, response);
    return response;
  }
  
  // Skip auth check for public routes
  if (isPublicRoute(pathname)) {
    return response;
  }
  
  // Check protected routes
  if (isProtectedRoute(pathname)) {
    // Check for session cookie
    // Note: This is a basic check. Full auth verification happens in page components
    // because Firebase Auth state is in localStorage, not accessible in middleware
    const hasSession = hasSessionCookie(request);
    
    if (!hasSession) {
      // No session cookie - redirect to login
      // The login page will set the session cookie after successful auth
      const loginUrl = new URL(getLoginRedirectUrl(pathname), request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      // Don't redirect if it's an API call (return 401 instead)
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return response;
}

// =============================================================================
// Middleware Configuration
// =============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
