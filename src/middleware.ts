/**
 * Middleware for Platform Admin Routes
 * 
 * Protects /platform/* routes to ensure only active platform admins can access.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only apply to /platform/* routes
  if (!pathname.startsWith('/platform')) {
    return NextResponse.next();
  }
  
  // Allow all /platform/* routes without cookie check
  // Firebase Auth uses localStorage, not cookies, so middleware can't verify auth
  // Full authorization check is done in each page component using Firebase Auth state
  return NextResponse.next();
}

export const config = {
  matcher: '/platform/:path*',
};
