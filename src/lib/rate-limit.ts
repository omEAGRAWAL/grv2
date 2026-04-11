// TODO v2: replace with Redis/Upstash for serverless

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map<string, RateLimitEntry>();

function getEntry(key: string): RateLimitEntry {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    return { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  // If lock has expired, reset
  if (entry.lockedUntil !== null && now > entry.lockedUntil) {
    return { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  // If the window has expired and not locked, reset
  if (entry.lockedUntil === null && now - entry.firstAttemptAt > WINDOW_MS) {
    return { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  return entry;
}

/**
 * Returns true if the key is currently locked out.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = getEntry(key);
  return entry.lockedUntil !== null && now < entry.lockedUntil;
}

/**
 * Record a failed attempt. Returns true if the account is now locked.
 */
export function recordFailure(key: string): boolean {
  const now = Date.now();
  const entry = getEntry(key);

  const newCount = entry.count + 1;
  const firstAttemptAt = entry.count === 0 ? now : entry.firstAttemptAt;
  const lockedUntil = newCount >= MAX_ATTEMPTS ? now + LOCK_DURATION_MS : null;

  store.set(key, { count: newCount, firstAttemptAt, lockedUntil });
  return lockedUntil !== null;
}

/**
 * Reset the failure counter after a successful login.
 */
export function resetFailures(key: string): void {
  store.delete(key);
}

// Exported for tests only
export const _store = store;
export const MAX_ATTEMPTS_EXPORT = MAX_ATTEMPTS;
export const WINDOW_MS_EXPORT = WINDOW_MS;
export const LOCK_DURATION_MS_EXPORT = LOCK_DURATION_MS;
