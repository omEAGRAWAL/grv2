import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExpense } from "@/app/actions/expenses";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

vi.mock("@/lib/db", () => {
  const mockDb = {
    site: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    walletTransaction: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockEmployee = { id: "emp1", role: "EMPLOYEE", name: "Ravi", isActive: true };
const mockOwner    = { id: "own1", role: "OWNER",    name: "Owner", isActive: true };
const mockSite     = { id: "site1", name: "Site Alpha" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.site.findFirst).mockResolvedValue(mockSite as any);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({} as any);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  amountPaise: "10000",   // ₹100
  siteId: "site1",
  category: "FOOD",
};

// ─── createExpense ────────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("debits actor wallet correctly — creates EXPENSE DEBIT txn", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(50000n); // ₹500

    await createExpense(null, makeForm(baseFields)).catch(() => {});

    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "emp1",
        loggedById: "emp1",
        type: "EXPENSE",
        direction: "DEBIT",
        amountPaise: 10000n,
        siteId: "site1",
        category: "FOOD",
      }),
    });
  });

  it("fails when balance is insufficient", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(5000n); // ₹50, need ₹100

    const result = await createExpense(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/insufficient/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails when site does not exist", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(50000n);
    vi.mocked(db.site.findFirst).mockResolvedValue(null);

    const result = await createExpense(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/site/i);
  });

  it("owner logs on behalf: actorUserId=employee, loggedById=owner", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockOwner as any);
    vi.mocked(getWalletBalance).mockResolvedValue(100000n);
    vi.mocked(db.user.findFirst).mockResolvedValue(mockEmployee as any);

    await createExpense(
      null,
      makeForm({ ...baseFields, onBehalfOfUserId: "emp1" })
    ).catch(() => {});

    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "emp1",
        loggedById: "own1",
      }),
    });
  });

  it("employee cannot log on behalf of another user (server enforces)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(100000n);

    const result = await createExpense(
      null,
      makeForm({ ...baseFields, onBehalfOfUserId: "emp2" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/owner/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  // Void action is built in a future phase; test is a placeholder.
  it.todo("voiding an expense correctly credits the wallet back");

  it("fails with zero amount", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(50000n);

    const result = await createExpense(
      null,
      makeForm({ ...baseFields, amountPaise: "0" })
    );

    expect(result?.success).toBe(false);
  });
});
