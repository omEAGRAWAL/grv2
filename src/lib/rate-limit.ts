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

// ─── Signup rate limit (IP-based) ─────────────────────────────────────────────

const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SIGNUP_MAX = 3;

interface SignupEntry {
  count: number;
  firstAttemptAt: number;
}

const signupStore = new Map<string, SignupEntry>();

export function checkSignupRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = signupStore.get(ip);
  if (!entry) return false;
  if (now - entry.firstAttemptAt > SIGNUP_WINDOW_MS) return false;
  return entry.count >= SIGNUP_MAX;
}

export function recordSignupAttempt(ip: string): void {
  const now = Date.now();
  const entry = signupStore.get(ip);
  if (!entry || now - entry.firstAttemptAt > SIGNUP_WINDOW_MS) {
    signupStore.set(ip, { count: 1, firstAttemptAt: now });
  } else {
    signupStore.set(ip, { count: entry.count + 1, firstAttemptAt: entry.firstAttemptAt });
  }
}

// Exported for tests only
export const _signupStore = signupStore;
export const SIGNUP_MAX_EXPORT = SIGNUP_MAX;
export const SIGNUP_WINDOW_MS_EXPORT = SIGNUP_WINDOW_MS;

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
