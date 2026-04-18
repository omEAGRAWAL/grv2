import { describe, it, expect, vi, beforeEach } from "vitest";
import { signupCompany } from "@/app/actions/signup";
import { db } from "@/lib/db";
import { checkSignupRateLimit, recordSignupAttempt, _signupStore, SIGNUP_MAX_EXPORT, SIGNUP_WINDOW_MS_EXPORT } from "@/lib/rate-limit";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  getSession: vi.fn().mockResolvedValue({ save: vi.fn(), userId: undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// ─── Rate limit tests ──────────────────────────────────────────────────────────

describe("signup rate limit", () => {
  beforeEach(() => {
    _signupStore.clear();
  });

  it("allows first signup from an IP", () => {
    expect(checkSignupRateLimit("1.2.3.4")).toBe(false);
  });

  it("blocks after SIGNUP_MAX attempts within window", () => {
    for (let i = 0; i < SIGNUP_MAX_EXPORT; i++) {
      recordSignupAttempt("5.6.7.8");
    }
    expect(checkSignupRateLimit("5.6.7.8")).toBe(true);
  });

  it("does not block a different IP", () => {
    for (let i = 0; i < SIGNUP_MAX_EXPORT; i++) {
      recordSignupAttempt("10.0.0.1");
    }
    expect(checkSignupRateLimit("10.0.0.2")).toBe(false);
  });

  it("resets after window expiry", () => {
    const ip = "9.9.9.9";
    _signupStore.set(ip, {
      count: SIGNUP_MAX_EXPORT,
      firstAttemptAt: Date.now() - SIGNUP_WINDOW_MS_EXPORT - 1,
    });
    expect(checkSignupRateLimit(ip)).toBe(false);
  });
});

// ─── signupCompany validation ──────────────────────────────────────────────────

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const validFields = {
  companyName: "Test Corp",
  ownerName: "Ramesh Kumar",
  mobile: "9876543210",
  username: "ramesh_k",
  password: "password123",
  confirmPassword: "password123",
  tos: "on",
};

describe("signupCompany server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _signupStore.clear();
    vi.mocked(db.company.findUnique).mockResolvedValue(null);
    vi.mocked(db.company.findFirst).mockResolvedValue(null);
    vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn({
      company: { create: vi.fn().mockResolvedValue({ id: "c1" }) },
      user: { create: vi.fn() },
    }));
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "OWNER",
      companyId: "c1",
    } as any);
  });

  it("rejects invalid mobile number", async () => {
    const state = await signupCompany(null, makeForm({ ...validFields, mobile: "1234567890" }));
    expect(state).toMatchObject({ error: expect.stringContaining("mobile") });
  });

  it("rejects mobile starting with 5", async () => {
    const state = await signupCompany(null, makeForm({ ...validFields, mobile: "5876543210" }));
    expect(state).toMatchObject({ field: "mobile" });
  });

  it("rejects password mismatch", async () => {
    const state = await signupCompany(
      null,
      makeForm({ ...validFields, confirmPassword: "differentpass" })
    );
    expect(state).toMatchObject({ error: "Passwords do not match", field: "confirmPassword" });
  });

  it("rejects username with uppercase letters", async () => {
    const state = await signupCompany(null, makeForm({ ...validFields, username: "Ramesh" }));
    expect(state).toMatchObject({ field: "username" });
  });

  it("rejects password shorter than 8 chars", async () => {
    const state = await signupCompany(
      null,
      makeForm({ ...validFields, password: "short", confirmPassword: "short" })
    );
    expect(state).toMatchObject({ field: "password" });
  });

  it("rejects duplicate mobile number", async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue({ id: "existing" } as any);
    const state = await signupCompany(null, makeForm(validFields));
    expect(state).toMatchObject({ field: "mobile" });
  });

  it("rejects duplicate company name", async () => {
    vi.mocked(db.company.findFirst).mockResolvedValue({ id: "existing" } as any);
    const state = await signupCompany(null, makeForm(validFields));
    expect(state).toMatchObject({ field: "companyName" });
  });

  it("calls redirect on success", async () => {
    await expect(signupCompany(null, makeForm(validFields))).rejects.toThrow("REDIRECT");
  });
});
