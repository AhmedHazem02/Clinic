/**
 * Simple In-Memory Rate Limiter for API Routes
 * 
 * For production with multiple instances, use Redis-based rate limiting (e.g., Upstash)
 * This is suitable for single-instance deployments or development.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier for the rate limit bucket (e.g., 'booking', 'search') */
  identifier: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if a request should be rate limited
 * 
 * @param clientId - Unique identifier for the client (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.identifier}:${clientId}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  
  // Check if over limit
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }
  
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request headers
 * Uses X-Forwarded-For header if available (for proxied requests),
 * otherwise falls back to a default identifier
 */
export function getClientId(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback - in production, this should be handled by the hosting platform
  return 'unknown-client';
}

// Pre-configured rate limiters for different endpoints
export const RATE_LIMITS = {
  /** Booking: 5 requests per minute per IP */
  booking: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    identifier: 'booking',
  },
  /** Search: 10 requests per minute per IP */
  search: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    identifier: 'search',
  },
  /** Queue count: 30 requests per minute per IP */
  queueCount: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    identifier: 'queue-count',
  },
  /** Admin operations: 20 requests per minute per IP */
  admin: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    identifier: 'admin',
  },
} as const;

/**
 * Helper function to create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetTime),
      },
    }
  );
}
