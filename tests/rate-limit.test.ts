import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  checkRateLimit,
  recordFailure,
  resetFailures,
  _store,
  MAX_ATTEMPTS_EXPORT as MAX_ATTEMPTS,
  WINDOW_MS_EXPORT as WINDOW_MS,
  LOCK_DURATION_MS_EXPORT as LOCK_DURATION_MS,
} from "@/lib/rate-limit";

describe("rate limiter", () => {
  beforeEach(() => {
    _store.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts below the threshold", () => {
    const key = "testuser";
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure(key);
      expect(checkRateLimit(key)).toBe(false);
    }
  });

  it("locks after MAX_ATTEMPTS failures", () => {
    const key = "lockme";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(checkRateLimit(key)).toBe(true);
  });

  it("6th attempt is rejected even if it is the correct password scenario", () => {
    const key = "brute";
    // 5 failures → locked
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    // 6th attempt: rate limit is already active
    expect(checkRateLimit(key)).toBe(true);
  });

  it("successful login resets the counter", () => {
    const key = "resetme";
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure(key);
    }
    resetFailures(key);
    expect(checkRateLimit(key)).toBe(false);
    // Can fail again without being locked
    recordFailure(key);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("lock expires after LOCK_DURATION_MS", () => {
    const key = "expiry";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(checkRateLimit(key)).toBe(true);
    // Advance time past the lock duration
    vi.advanceTimersByTime(LOCK_DURATION_MS + 1);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("window resets after WINDOW_MS without lock", () => {
    const key = "window";
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure(key);
    }
    // Advance past the window
    vi.advanceTimersByTime(WINDOW_MS + 1);
    // Now the window resets — recordFailure starts fresh
    recordFailure(key);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("returns false for unknown keys", () => {
    expect(checkRateLimit("never-tried")).toBe(false);
  });
});
