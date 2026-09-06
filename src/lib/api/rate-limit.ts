import { env } from "@/lib/env";

/**
 * In-process fixed-window rate limiter. Adequate for a single-node modular
 * monolith; swap the store for Redis when the API is horizontally scaled.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const limit = env.apiRateLimit();
  const windowMs = env.apiRateWindowSeconds() * 1000;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0, limit };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      limit,
    };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0, limit };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${new URL(request.url).pathname}`;
}

/** Test helper: clears all windows. */
export function resetRateLimits(): void {
  buckets.clear();
}
