import "server-only";

/**
 * Login throttling.
 *
 * Sign-in is a server action rather than an API route, so the /api rate
 * limiter never sees it. Without this, the login form is an unmetered
 * password-guessing oracle.
 *
 * Attempts are counted per email and per client address: locking only by email
 * would let an attacker lock a colleague out, and locking only by address
 * would miss a distributed attempt against one account.
 */

interface Attempt {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, Attempt>();

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

function prune(now: number): void {
  if (attempts.size < MAX_TRACKED) return;
  for (const [key, attempt] of attempts) {
    if (attempt.lockedUntil < now && now - attempt.firstFailureAt > WINDOW_MS) attempts.delete(key);
  }
}

export interface ThrottleState {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

export function checkLoginThrottle(keys: string[]): ThrottleState {
  const now = Date.now();
  let worst: ThrottleState = { allowed: true, retryAfterSeconds: 0, remainingAttempts: MAX_FAILURES };

  for (const key of keys) {
    const attempt = attempts.get(key);
    if (!attempt) continue;
    if (attempt.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      if (retryAfterSeconds > worst.retryAfterSeconds) {
        worst = { allowed: false, retryAfterSeconds, remainingAttempts: 0 };
      }
      continue;
    }
    if (now - attempt.firstFailureAt > WINDOW_MS) {
      attempts.delete(key);
      continue;
    }
    const remaining = Math.max(0, MAX_FAILURES - attempt.failures);
    if (remaining < worst.remainingAttempts) worst = { ...worst, remainingAttempts: remaining };
  }
  return worst;
}

export function recordLoginFailure(keys: string[]): void {
  const now = Date.now();
  prune(now);
  for (const key of keys) {
    const attempt = attempts.get(key);
    if (!attempt || now - attempt.firstFailureAt > WINDOW_MS) {
      attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
      continue;
    }
    attempt.failures += 1;
    if (attempt.failures >= MAX_FAILURES) attempt.lockedUntil = now + LOCK_MS;
  }
}

/** Called on success so a legitimate user is not penalised for earlier typos. */
export function clearLoginFailures(keys: string[]): void {
  for (const key of keys) attempts.delete(key);
}

/** Test helper. */
export function resetLoginThrottle(): void {
  attempts.clear();
}

export const LOGIN_THROTTLE = { MAX_FAILURES, WINDOW_MS, LOCK_MS };
