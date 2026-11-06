interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60000;
const MAX_STORE_SIZE = 5000;

/**
 * Request-triggered periodic sweep.
 * Safely removes expired entries without background timers,
 * complying with Cloudflare Workers' strict global-scope rules.
 */
function cleanupExpiredRecords(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS && rateLimitStore.size < MAX_STORE_SIZE) {
    return;
  }
  lastCleanupAt = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }

  // Safety valve: prevent unbounded growth under high load
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const keysToDelete = Array.from(rateLimitStore.keys()).slice(0, 1000);
    for (const k of keysToDelete) {
      rateLimitStore.delete(k);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Lightweight sliding window rate limiter
 * @param key Identifier (e.g. "login:ip", "order:sessionId")
 * @param maxRequests Maximum requests allowed within window
 * @param windowMs Window duration in milliseconds (default: 60,000ms = 1 min)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredRecords(now);

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Extract client IP address safely from standard headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}
