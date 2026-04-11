import { describe, it, expect, vi, beforeEach } from "vitest";
import { topUpWallet } from "@/app/actions/wallet";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    walletTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) =>
      fn(db)
    ),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockOwner = { id: "owner1", role: "OWNER", name: "Owner" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({} as any);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ─── topUpWallet action ───────────────────────────────────────────────────────

describe("topUpWallet", () => {
  it("creates correct WalletTransaction for valid top-up", async () => {
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "100.00", note: "Test top-up" })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "emp1",
        loggedById: "owner1",
        type: "TOPUP",
        direction: "CREDIT",
        amountPaise: 10000n,
        note: "Test top-up",
      }),
    });
  });

  it("stores correct paise for fractional rupee amounts", async () => {
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "250.50" })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({ amountPaise: 25050n }),
    });
  });

  it("fails with negative amount", async () => {
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "-100" })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails with zero amount", async () => {
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "0" })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /greater than/i
    );
  });

  it("fails by non-owner with Unauthorized error", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("Forbidden"));

    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "100" })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /unauthorized/i
    );
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails with non-numeric amount", async () => {
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "abc" })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("balance reflects top-up: creates transaction with correct amountPaise", async () => {
    // ₹10,000 = 1,000,000 paise
    const result = await topUpWallet(
      null,
      makeForm({ employeeId: "emp1", amount: "10000" })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountPaise: 1000000n,
        direction: "CREDIT",
        actorUserId: "emp1",
      }),
    });
  });
});
