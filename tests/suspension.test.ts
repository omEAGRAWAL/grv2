import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginAction } from "@/app/actions/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => {
  const mockDb = {
    user: { findFirst: vi.fn(), update: vi.fn() },
    company: { findUnique: vi.fn() },
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  getSession: vi.fn().mockResolvedValue({
    userId: undefined,
    save: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue(false),
  recordFailure: vi.fn(),
  resetFailures: vi.fn(),
}));

function makeLoginForm(username: string, password: string): FormData {
  const fd = new FormData();
  fd.append("username", username);
  fd.append("password", password);
  return fd;
}

describe("suspended company login rejection", () => {
  const activeUser = {
    id: "u1",
    username: "ramesh",
    passwordHash: "hash",
    isActive: true,
    companyId: "co1",
    role: "OWNER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findFirst).mockResolvedValue(activeUser as any);
    vi.mocked(db.user.update).mockResolvedValue({} as any);
  });

  it("rejects login when company is SUSPENDED", async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue({ status: "SUSPENDED" } as any);

    const result = await loginAction(null, makeLoginForm("ramesh", "pass"));
    expect(result).toMatchObject({ error: expect.stringContaining("suspended") });
  });

  it("allows login when company is ACTIVE", async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue({ status: "ACTIVE" } as any);

    await expect(loginAction(null, makeLoginForm("ramesh", "pass"))).rejects.toThrow("REDIRECT");
  });

  it("allows login for SUPERADMIN (no companyId)", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      ...activeUser,
      companyId: null,
      role: "SUPERADMIN",
    } as any);

    await expect(loginAction(null, makeLoginForm("super_admin", "pass"))).rejects.toThrow("REDIRECT");
    expect(db.company.findUnique).not.toHaveBeenCalled();
  });
});
