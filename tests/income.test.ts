import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSiteIncome, voidSiteIncome } from "@/app/actions/incomes";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    site: { findUnique: vi.fn() },
    siteIncome: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  },
}));

vi.mock("@/lib/auth", () => ({ requireOwner: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockOwner = { id: "own1", role: "OWNER", name: "Owner", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(db.site.findUnique).mockResolvedValue({ id: "site1" } as any);
  vi.mocked(db.siteIncome.create).mockResolvedValue({ id: "inc1" } as any);
  vi.mocked(db.siteIncome.findUnique).mockResolvedValue(null);
  vi.mocked(db.siteIncome.update).mockResolvedValue({} as any);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  siteId: "site1",
  amountRupees: "500000",
  receivedDate: "2026-04-01",
  type: "ADVANCE",
};

describe("createSiteIncome", () => {
  it("creates income and returns success", async () => {
    const result = await createSiteIncome(null, makeForm(baseFields));

    expect(result.success).toBe(true);
    expect(vi.mocked(db.siteIncome.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.siteIncome.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siteId: "site1",
          amountPaise: 50000000n, // ₹5,00,000
          type: "ADVANCE",
          loggedById: "own1",
        }),
      })
    );
  });

  it("fails when amount is negative", async () => {
    const result = await createSiteIncome(
      null,
      makeForm({ ...baseFields, amountRupees: "-100" })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.siteIncome.create)).not.toHaveBeenCalled();
  });

  it("fails when amount is zero", async () => {
    const result = await createSiteIncome(
      null,
      makeForm({ ...baseFields, amountRupees: "0" })
    );

    expect(result.success).toBe(false);
  });

  it("fails when site is not found", async () => {
    vi.mocked(db.site.findUnique).mockResolvedValue(null);

    const result = await createSiteIncome(null, makeForm(baseFields));

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/site not found/i);
    expect(vi.mocked(db.siteIncome.create)).not.toHaveBeenCalled();
  });

  it("fails when not authenticated as owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("Forbidden"));

    const result = await createSiteIncome(null, makeForm(baseFields));

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/only owners/i);
  });

  it("fails when income type is invalid", async () => {
    const result = await createSiteIncome(
      null,
      makeForm({ ...baseFields, type: "FAKE_TYPE" })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.siteIncome.create)).not.toHaveBeenCalled();
  });
});

describe("voidSiteIncome", () => {
  it("voids an income record", async () => {
    vi.mocked(db.siteIncome.findUnique).mockResolvedValue({
      id: "inc1",
      siteId: "site1",
      voidedAt: null,
    } as any);

    const result = await voidSiteIncome("inc1");

    expect(result.success).toBe(true);
    expect(vi.mocked(db.siteIncome.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inc1" },
        data: expect.objectContaining({ voidedById: "own1" }),
      })
    );
  });

  it("fails if income already voided", async () => {
    vi.mocked(db.siteIncome.findUnique).mockResolvedValue({
      id: "inc1",
      siteId: "site1",
      voidedAt: new Date(),
    } as any);

    const result = await voidSiteIncome("inc1");

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/already voided/i);
    expect(vi.mocked(db.siteIncome.update)).not.toHaveBeenCalled();
  });

  it("fails if income not found", async () => {
    vi.mocked(db.siteIncome.findUnique).mockResolvedValue(null);

    const result = await voidSiteIncome("missing");

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/not found/i);
  });
});
