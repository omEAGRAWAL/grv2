import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSiteSpend } from "@/lib/site-financials";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => {
  const mockDb = {
    walletTransaction: { aggregate: vi.fn() },
    purchase: { aggregate: vi.fn() },
    materialTransfer: { aggregate: vi.fn() },
    assetAllocation: { findMany: vi.fn() },
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

// Helper to set up mock responses for all 4 aggregates.
// Order of calls: walletTransaction.aggregate (A), purchase.aggregate (B),
//                 materialTransfer.aggregate (C - in), materialTransfer.aggregate (D - out)
function setupMocks(A: bigint, B: bigint, C: bigint, D: bigint) {
  vi.mocked(db.walletTransaction.aggregate).mockResolvedValue({
    _sum: { amountPaise: A },
  } as any);
  vi.mocked(db.purchase.aggregate).mockResolvedValue({
    _sum: { totalPaise: B },
  } as any);
  vi.mocked(db.materialTransfer.aggregate)
    .mockResolvedValueOnce({ _sum: { costMovedPaise: C } } as any) // C: transfers IN
    .mockResolvedValueOnce({ _sum: { costMovedPaise: D } } as any); // D: transfers OUT
}

describe("getSiteSpend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.assetAllocation.findMany).mockResolvedValue([]);
  });

  it("returns 0n for a site with no activity", async () => {
    setupMocks(0n, 0n, 0n, 0n);
    expect(await getSiteSpend("site-empty")).toBe(0n);
  });

  it("handles null sums (no rows) gracefully", async () => {
    vi.mocked(db.walletTransaction.aggregate).mockResolvedValue({
      _sum: { amountPaise: null },
    } as any);
    vi.mocked(db.purchase.aggregate).mockResolvedValue({
      _sum: { totalPaise: null },
    } as any);
    vi.mocked(db.materialTransfer.aggregate)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: null } } as any)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: null } } as any);

    expect(await getSiteSpend("site-null")).toBe(0n);
  });

  /**
   * The exact scenario from task 7 in the Phase 4 spec:
   *
   * - Site X
   * - Ramesh logs ₹3,000 expense at Site X      → A: +300000n paise
   * - Owner buys cement ₹20,000 paid by Ramesh,
   *   dest Site X (wallet VENDOR_PAYMENT)        → A: +2000000n paise
   * - Owner buys steel ₹15,000 owner-direct,
   *   dest Site X                                → B: +1500000n paise
   * - Material transfer: ₹5,000 cement from
   *   Site X to Site Y                           → D: +500000n paise
   * - Material transfer in: ₹2,000 sand from
   *   Central Store to Site X                    → C: +200000n paise
   *
   * Expected: 3000 + 20000 + 15000 - 5000 + 2000 = ₹35,000
   *           = 3500000n paise
   */
  it("full scenario: expense + wallet purchase + owner-direct + transfers net = ₹35,000", async () => {
    const A = 300000n + 2000000n; // ₹3,000 expense + ₹20,000 vendor payment
    const B = 1500000n;           // ₹15,000 owner-direct purchase
    const C = 200000n;            // ₹2,000 sand transfer in
    const D = 500000n;            // ₹5,000 cement transfer out

    setupMocks(A, B, C, D);

    const total = await getSiteSpend("site-x");
    expect(total).toBe(3500000n); // ₹35,000
  });

  it("correctly excludes voided rows (mocks verify where clauses)", async () => {
    // Set up non-zero values so we know the where clause matters
    setupMocks(1000n, 500n, 200n, 100n);

    await getSiteSpend("site-y");

    // Verify each aggregate was called with voidedAt: null
    expect(vi.mocked(db.walletTransaction.aggregate)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ voidedAt: null }),
      })
    );
    expect(vi.mocked(db.purchase.aggregate)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ voidedAt: null }),
      })
    );
    expect(vi.mocked(db.materialTransfer.aggregate)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ voidedAt: null }),
      })
    );
  });

  it("only counts owner-direct purchases in component B (paidByUserId: null)", async () => {
    setupMocks(0n, 100n, 0n, 0n);

    await getSiteSpend("site-z");

    expect(vi.mocked(db.purchase.aggregate)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paidByUserId: null }),
      })
    );
  });

  it("correctly subtracts transfers OUT from spend (material left the site)", async () => {
    // Bought ₹10,000 worth, transferred out ₹4,000 → net spend ₹6,000
    setupMocks(0n, 1000000n, 0n, 400000n);
    expect(await getSiteSpend("site-w")).toBe(600000n);
  });

  it("correctly adds transfers IN to spend (material arrived at cost)", async () => {
    // No purchases, ₹3,000 arrived via transfer → net spend ₹3,000
    setupMocks(0n, 0n, 300000n, 0n);
    expect(await getSiteSpend("site-v")).toBe(300000n);
  });
});
