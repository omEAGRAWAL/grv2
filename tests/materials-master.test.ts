/**
 * Tests for Phase 13: company material master list
 *   - Default materials seeded for new company (via signup action)
 *   - Cannot delete default material
 *   - Cannot delete material in use (purchase or consumption)
 *   - Material uniqueness enforced per company, not globally
 *   - createMaterial / updateMaterial happy paths
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMaterial, updateMaterial, deleteMaterial } from "@/app/actions/materials";
import { signupCompany } from "@/app/actions/signup";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

vi.mock("@/lib/db", () => {
  const mockDb = {
    material: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    purchase: { findFirst: vi.fn() },
    materialConsumption: { findFirst: vi.fn() },
    company: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user: { create: vi.fn(), findFirst: vi.fn() },
    assetCategory: { createMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireOwner: vi.fn(),
  requireRole: vi.fn(),
  hashPassword: vi.fn(() => "hashed"),
  getSession: vi.fn(() => ({ save: vi.fn(), userId: undefined, role: undefined, companyId: undefined })),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkSignupRateLimit: vi.fn(() => false),
  recordSignupAttempt: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(() => ({ get: vi.fn(() => "127.0.0.1") })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(() => "hashed") } }));

const mockOwner = {
  id: "own1",
  role: "OWNER",
  name: "Owner",
  isActive: true,
  effectiveCompanyId: "cmp1",
};

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(mockOwner as never);
  vi.mocked(db.material.findFirst).mockResolvedValue(null); // no conflict by default
  vi.mocked(db.material.create).mockResolvedValue({ id: "mat1" } as never);
  vi.mocked(db.material.update).mockResolvedValue({ id: "mat1" } as never);
  vi.mocked(db.purchase.findFirst).mockResolvedValue(null);
  vi.mocked(db.materialConsumption.findFirst).mockResolvedValue(null);
});

// ─── createMaterial ───────────────────────────────────────────────────────────

describe("createMaterial", () => {
  it("creates a material successfully", async () => {
    const result = await createMaterial(null, makeForm({ name: "Steel", unit: "kg" }));
    expect(result.success).toBe(true);
    expect(vi.mocked(db.material.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Steel", unit: "kg", isDefault: false }),
      })
    );
  });

  it("rejects duplicate name (case-insensitive)", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValue({ id: "mat0", name: "Steel" } as never);
    const result = await createMaterial(null, makeForm({ name: "steel", unit: "kg" }));
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/already exists/i);
    expect(vi.mocked(db.material.create)).not.toHaveBeenCalled();
  });

  it("requires name", async () => {
    const result = await createMaterial(null, makeForm({ name: "", unit: "kg" }));
    expect(result.success).toBe(false);
  });

  it("requires unit", async () => {
    const result = await createMaterial(null, makeForm({ name: "Tiles", unit: "" }));
    expect(result.success).toBe(false);
  });
});

// ─── updateMaterial ───────────────────────────────────────────────────────────

describe("updateMaterial", () => {
  it("updates a non-default material", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValueOnce({ id: "mat1", isDefault: false } as never);
    vi.mocked(db.material.findFirst).mockResolvedValueOnce(null); // no name conflict

    const result = await updateMaterial("mat1", null, makeForm({ name: "Bricks Red", unit: "nos" }));
    expect(result.success).toBe(true);
    expect(vi.mocked(db.material.update)).toHaveBeenCalledOnce();
  });

  it("rejects editing a default material", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValueOnce({ id: "mat1", isDefault: true } as never);

    const result = await updateMaterial("mat1", null, makeForm({ name: "Cement", unit: "bag" }));
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/default/i);
    expect(vi.mocked(db.material.update)).not.toHaveBeenCalled();
  });
});

// ─── deleteMaterial ───────────────────────────────────────────────────────────

describe("deleteMaterial", () => {
  it("deletes an unused non-default material", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValue({ id: "mat1", name: "Custom Mat", isDefault: false } as never);
    vi.mocked(db.material.delete).mockResolvedValue({} as never);

    const result = await deleteMaterial("mat1");
    expect(result.success).toBe(true);
    expect(vi.mocked(db.material.delete)).toHaveBeenCalledWith({ where: { id: "mat1" } });
  });

  it("cannot delete a default material", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValue({ id: "mat0", name: "Cement", isDefault: true } as never);

    const result = await deleteMaterial("mat0");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/default/i);
    expect(vi.mocked(db.material.delete)).not.toHaveBeenCalled();
  });

  it("cannot delete a material used in a purchase", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValue({ id: "mat1", name: "Steel", isDefault: false } as never);
    vi.mocked(db.purchase.findFirst).mockResolvedValue({ id: "pur1" } as never);

    const result = await deleteMaterial("mat1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/purchase/i);
    expect(vi.mocked(db.material.delete)).not.toHaveBeenCalled();
  });

  it("cannot delete a material used in material consumption", async () => {
    vi.mocked(db.material.findFirst).mockResolvedValue({ id: "mat1", name: "Sand", isDefault: false } as never);
    vi.mocked(db.purchase.findFirst).mockResolvedValue(null);
    vi.mocked(db.materialConsumption.findFirst).mockResolvedValue({ id: "con1" } as never);

    const result = await deleteMaterial("mat1");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/consumption/i);
    expect(vi.mocked(db.material.delete)).not.toHaveBeenCalled();
  });
});

// ─── uniqueness per company ───────────────────────────────────────────────────

describe("material uniqueness — per company, not global", () => {
  it("two companies can each have a material with the same name", async () => {
    // For companyA: no conflict
    vi.mocked(db.material.findFirst).mockResolvedValue(null);

    const result = await createMaterial(null, makeForm({ name: "Cement", unit: "bag" }));
    expect(result.success).toBe(true);
    // The uniqueness check uses companyId scoping — tested by the fact
    // that findFirst is called with { companyId, name: { equals, mode: "insensitive" } }
    const findCall = vi.mocked(db.material.findFirst).mock.calls[0]?.[0] as { where: { companyId: string } };
    expect(findCall?.where).toMatchObject({ companyId: "cmp1" });
  });
});

// ─── signup seeds default materials ──────────────────────────────────────────

describe("signupCompany seeds default materials", () => {
  it("calls material.createMany with isDefault=true for all default entries", async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(null);
    vi.mocked(db.company.findFirst).mockResolvedValue(null);
    vi.mocked(db.company.create).mockResolvedValue({ id: "newCmp" } as never);
    vi.mocked(db.user.create).mockResolvedValue({ id: "newOwn" } as never);
    vi.mocked(db.assetCategory.createMany).mockResolvedValue({ count: 8 } as never);
    vi.mocked(db.material.createMany).mockResolvedValue({ count: 10 } as never);
    vi.mocked(db.user.findFirst).mockResolvedValue(null); // skip auto-login

    const form = makeForm({
      companyName: "Test Co",
      ownerName: "Test Owner",
      mobile: "9876543210",
      username: "testowner",
      password: "password123",
      confirmPassword: "password123",
      tos: "on",
    });

    await signupCompany(null, form).catch(() => {});

    const createManyCall = vi.mocked(db.material.createMany).mock.calls[0][0];
    const data = createManyCall.data as { name: string; unit: string; isDefault: boolean }[];
    expect(data.length).toBe(10);
    expect(data.every((m) => m.isDefault)).toBe(true);
  });
});
