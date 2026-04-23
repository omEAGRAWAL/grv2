import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSiteSpend, getSiteIncome, getSitePnL } from "@/lib/site-financials";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => {
  const mockDb = {
    walletTransaction: { aggregate: vi.fn(), groupBy: vi.fn() },
    purchase: { aggregate: vi.fn(), groupBy: vi.fn() },
    materialTransfer: { aggregate: vi.fn(), groupBy: vi.fn() },
    siteIncome: { aggregate: vi.fn(), groupBy: vi.fn() },
    assetAllocation: { findMany: vi.fn() },
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

function mockAgg(val: bigint | null) {
  return { _sum: { amountPaise: val, totalPaise: val, costMovedPaise: val } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.walletTransaction.aggregate).mockResolvedValue(mockAgg(0n) as any);
  vi.mocked(db.purchase.aggregate).mockResolvedValue(mockAgg(0n) as any);
  vi.mocked(db.materialTransfer.aggregate).mockResolvedValue(mockAgg(0n) as any);
  vi.mocked(db.siteIncome.aggregate).mockResolvedValue(mockAgg(0n) as any);
  vi.mocked(db.assetAllocation.findMany).mockResolvedValue([]);
});

// ─── getSiteIncome ────────────────────────────────────────────────────────────

describe("getSiteIncome", () => {
  it("returns zero when no income records", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: null } } as any);
    expect(await getSiteIncome("site1")).toBe(0n);
  });

  it("sums non-voided income correctly", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 50000000n } } as any);
    expect(await getSiteIncome("site1")).toBe(50000000n);
  });
});

// ─── getSitePnL ───────────────────────────────────────────────────────────────

describe("getSitePnL", () => {
  function mockSpend(
    walletAmt: bigint,
    purchaseAmt: bigint,
    transferIn: bigint,
    transferOut: bigint
  ) {
    vi.mocked(db.walletTransaction.aggregate).mockResolvedValue(
      { _sum: { amountPaise: walletAmt } } as any
    );
    vi.mocked(db.purchase.aggregate).mockResolvedValue(
      { _sum: { totalPaise: purchaseAmt } } as any
    );
    vi.mocked(db.materialTransfer.aggregate)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: transferIn } } as any)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: transferOut } } as any);
  }

  it("returns all zeros for site with no activity", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 0n } } as any);
    const result = await getSitePnL("site1", 1500000000n);

    expect(result.received).toBe(0n);
    expect(result.spent).toBe(0n);
    expect(result.pnl).toBe(0n);
    expect(result.budgetUsedPercent).toBe(0);
  });

  it("computes correct P&L for complex scenario", async () => {
    // Income = ₹5,00,000 = 50000000n
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 50000000n } } as any);

    // Spend:
    // A (wallet) = ₹3,000 + ₹20,000 (vendor payment) = 2300000n
    // B (owner-direct purchase) = 0n
    // C (material IN) = ₹15,000 = 1500000n
    // D (material OUT) = ₹5,000 = 500000n
    // Spend = 2300000 + 0 + 1500000 - 500000 = 3300000n = ₹33,000
    mockSpend(2300000n, 0n, 1500000n, 500000n);

    const contract = 1500000000n; // ₹15,00,000
    const result = await getSitePnL("site1", contract);

    expect(result.received).toBe(50000000n);
    expect(result.spent).toBe(3300000n);
    expect(result.pnl).toBe(50000000n - 3300000n); // ₹4,67,000
    // budgetUsedPercent = (3300000 / 1500000000) * 100 = 0.22%
    expect(result.budgetUsedPercent).toBeCloseTo(0.22, 1);
  });

  it("returns negative P&L when spent > received", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 10000000n } } as any);
    mockSpend(50000000n, 0n, 0n, 0n);

    const result = await getSitePnL("site1", 100000000n);

    expect(result.pnl).toBe(10000000n - 50000000n); // −₹4,00,000
    expect(result.pnl < 0n).toBe(true);
  });

  it("returns budgetUsedPercent > 100 when over budget", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 0n } } as any);
    // Spend ₹20,00,000 against budget ₹15,00,000
    mockSpend(200000000n, 0n, 0n, 0n);

    const result = await getSitePnL("site1", 150000000n);

    expect(result.budgetUsedPercent).toBeGreaterThan(100);
    expect(result.budgetUsedPercent).toBeCloseTo(133.33, 1);
  });

  it("handles zero contract value gracefully", async () => {
    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 0n } } as any);
    mockSpend(100000n, 0n, 0n, 0n);

    const result = await getSitePnL("site1", 0n);

    expect(result.budgetUsedPercent).toBe(0);
    expect(result.spent).toBe(100000n);
  });

  it("20-step test scenario: full reconciliation", async () => {
    // Site A: contract ₹15,00,000
    // Expenses from wallet: ₹3,000 + ₹2,500 = ₹5,500 = 550000n
    // Purchase (wallet-paid Ramesh): 50 bags cement @ ₹380, 5% disc, 18% GST
    //   = 50 × 38000p × 0.95 × 1.18 = 50 × 38000 × 1.121 = 2129900p (approx)
    //   wallet VENDOR_PAYMENT = 2129900n (counted in A)
    // Owner-direct purchase: 0 for site A
    // Material IN: 0 for site A (cement was purchased to site A directly)
    // Material OUT: 20 bags cement transferred out → let's say costMovedPaise = 852000n
    // Income: ₹5,00,000 advance = 50000000n

    const walletDebit = 550000n + 2129900n; // expenses + vendor payment
    const ownerDirectPurchase = 0n;
    const matIn = 0n;
    const matOut = 852000n; // 20 bags transferred out

    vi.mocked(db.siteIncome.aggregate).mockResolvedValue({ _sum: { amountPaise: 50000000n } } as any);
    vi.mocked(db.walletTransaction.aggregate).mockResolvedValue({ _sum: { amountPaise: walletDebit } } as any);
    vi.mocked(db.purchase.aggregate).mockResolvedValue({ _sum: { totalPaise: ownerDirectPurchase } } as any);
    vi.mocked(db.materialTransfer.aggregate)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: matIn } } as any)
      .mockResolvedValueOnce({ _sum: { costMovedPaise: matOut } } as any);

    const result = await getSitePnL("site1", 150000000n);

    const expectedSpent = walletDebit + ownerDirectPurchase + matIn - matOut;
    expect(result.received).toBe(50000000n);
    expect(result.spent).toBe(expectedSpent);
    expect(result.pnl).toBe(50000000n - expectedSpent);
    expect(result.budgetUsedPercent).toBeCloseTo(
      (Number(expectedSpent) / 150000000) * 100,
      1
    );
  });
});
