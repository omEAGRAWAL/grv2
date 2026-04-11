import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWalletBalance, getCashWithTeam } from "@/lib/wallet";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    walletTransaction: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getWalletBalance ─────────────────────────────────────────────────────────

describe("getWalletBalance", () => {
  it("returns 0n for user with no transactions", async () => {
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([]);
    expect(await getWalletBalance("user1")).toBe(0n);
  });

  it("correctly sums credits and debits", async () => {
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([
      { direction: "CREDIT", amountPaise: 10000n } as any,
      { direction: "CREDIT", amountPaise: 5000n } as any,
      { direction: "DEBIT", amountPaise: 3000n } as any,
    ]);
    expect(await getWalletBalance("user1")).toBe(12000n);
  });

  it("excludes voided transactions via voidedAt:null in query", async () => {
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([
      { direction: "CREDIT", amountPaise: 10000n } as any,
    ]);
    await getWalletBalance("user1");
    expect(vi.mocked(db.walletTransaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ voidedAt: null }),
      })
    );
  });

  it("returns correct balance when all transactions are debits", async () => {
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([
      { direction: "DEBIT", amountPaise: 5000n } as any,
      { direction: "DEBIT", amountPaise: 3000n } as any,
    ]);
    expect(await getWalletBalance("user1")).toBe(-8000n);
  });

  it("handles large paise amounts without overflow", async () => {
    const large = 50_000_000_00n; // ₹5 crore
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([
      { direction: "CREDIT", amountPaise: large } as any,
    ]);
    expect(await getWalletBalance("user1")).toBe(large);
  });
});

// ─── getCashWithTeam ──────────────────────────────────────────────────────────

describe("getCashWithTeam", () => {
  it("sums balances of all active employees correctly", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      { id: "emp1" } as any,
      { id: "emp2" } as any,
    ]);
    vi.mocked(db.walletTransaction.findMany)
      .mockResolvedValueOnce([
        { direction: "CREDIT", amountPaise: 10000n } as any,
      ])
      .mockResolvedValueOnce([
        { direction: "CREDIT", amountPaise: 25000n } as any,
      ]);

    expect(await getCashWithTeam()).toBe(35000n);
  });

  it("excludes inactive employees via isActive:true filter", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "emp1" } as any]);
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([
      { direction: "CREDIT", amountPaise: 10000n } as any,
    ]);

    const total = await getCashWithTeam();
    expect(total).toBe(10000n);
    expect(vi.mocked(db.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("returns 0n when no active employees exist", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    expect(await getCashWithTeam()).toBe(0n);
  });
});
