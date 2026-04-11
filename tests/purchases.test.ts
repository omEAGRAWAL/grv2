import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPurchase, voidPurchase } from "@/app/actions/purchases";
import { calcPurchaseTotalPaise } from "@/lib/purchase-math";
import { db } from "@/lib/db";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

vi.mock("@/lib/db", () => ({
  db: {
    vendor: { findUnique: vi.fn() },
    user:   { findUnique: vi.fn() },
    purchase: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    walletTransaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireOwner:   vi.fn(),
}));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn() }));
vi.mock("next/cache",      () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockOwner    = { id: "own1", role: "OWNER", name: "Owner", isActive: true };
const mockEmployee = { id: "emp1", role: "EMPLOYEE", name: "Ramesh", isActive: true };
const mockVendor   = { id: "ven1", name: "Shree Cements" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(getCurrentUser).mockResolvedValue(mockOwner as any);
  vi.mocked(db.vendor.findUnique).mockResolvedValue(mockVendor as any);
  vi.mocked(db.user.findUnique).mockResolvedValue(mockEmployee as any);
  vi.mocked(db.purchase.create).mockResolvedValue({ id: "pur1", totalPaise: 26550n } as any);
  vi.mocked(db.purchase.findUnique).mockResolvedValue(null);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({} as any);
  vi.mocked(db.walletTransaction.findFirst).mockResolvedValue(null);
  vi.mocked(getWalletBalance).mockResolvedValue(10000000n); // ₹1,00,000
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  vendorId:       "ven1",
  itemName:       "Cement 50kg",
  quantity:       "100",
  unit:           "bags",
  rateRupees:     "350",
  discountPercent: "0",
  gstPercent:     "18",
  destinationSiteId: "site1",
  paidByUserId:   "emp1",
  purchaseDate:   "2026-04-01",
};

// ─── calcPurchaseTotalPaise unit tests ────────────────────────────────────────

describe("calcPurchaseTotalPaise", () => {
  it("qty × rate, no discount, no GST", () => {
    // 10 bags × ₹100 = ₹1000 = 100000 paise
    expect(calcPurchaseTotalPaise("10", 10000n, "0", "0")).toBe(100000n);
  });

  it("applies discount correctly (10% off)", () => {
    // 10 × 10000 = 100000; discount = 10000; after = 90000; gst = 0; total = 90000
    expect(calcPurchaseTotalPaise("10", 10000n, "10", "0")).toBe(90000n);
  });

  it("applies GST correctly (18% GST, no discount)", () => {
    // 10 × 10000 = 100000; gst = 18000; total = 118000
    expect(calcPurchaseTotalPaise("10", 10000n, "0", "18")).toBe(118000n);
  });

  it("applies discount + GST correctly", () => {
    // 2.5 bags × ₹100 (10000p) = 25000p subtotal
    // discount 10% = 2500p → after = 22500p
    // GST 18% = 4050p → total = 26550p
    expect(calcPurchaseTotalPaise("2.5", 10000n, "10", "18")).toBe(26550n);
  });

  it("handles fractional quantity", () => {
    // 1.5 × 5000 = 7500; 0% disc, 0% gst → 7500
    expect(calcPurchaseTotalPaise("1.5", 5000n, "0", "0")).toBe(7500n);
  });

  it("rounds to nearest paise (ROUND_HALF_UP)", () => {
    // 1 × 3333p × (1 + 0.18) = 3332.94... → rounds to 3933
    // Actually 3333 * 1.18 = 3932.94 → 3933
    expect(calcPurchaseTotalPaise("1", 3333n, "0", "18")).toBe(3933n);
  });

  it("zero discount and zero GST produces qty × rate", () => {
    expect(calcPurchaseTotalPaise("100", 35000n, "0", "0")).toBe(3500000n);
  });
});

// ─── createPurchase action tests ──────────────────────────────────────────────

describe("createPurchase", () => {
  it("creates purchase and VENDOR_PAYMENT wallet txn when paid by wallet", async () => {
    await createPurchase(null, makeForm(baseFields)).catch(() => {});

    expect(vi.mocked(db.purchase.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "emp1",
          type: "VENDOR_PAYMENT",
          direction: "DEBIT",
        }),
      })
    );
  });

  it("creates purchase with correct server-computed totalPaise", async () => {
    // 100 bags × ₹350 × (1 - 0%) × (1 + 18%) = 100 × 35000p × 1.18 = 4130000p
    await createPurchase(null, makeForm(baseFields)).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.totalPaise).toBe(4130000n);
  });

  it("does NOT create wallet txn when owner-direct (paidByUserId=OWNER_DIRECT)", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, paidByUserId: "OWNER_DIRECT" })
    ).catch(() => {});

    expect(vi.mocked(db.purchase.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("stores null destinationSiteId when CENTRAL_STORE", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, destinationSiteId: "CENTRAL_STORE" })
    ).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.destinationSiteId).toBeNull();
  });

  it("fails with insufficient balance and does NOT create purchase", async () => {
    vi.mocked(getWalletBalance).mockResolvedValue(100n); // only ₹1

    const result = await createPurchase(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/insufficient/i);
    expect(vi.mocked(db.purchase.create)).not.toHaveBeenCalled();
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails when vendor not found", async () => {
    vi.mocked(db.vendor.findUnique).mockResolvedValue(null);

    const result = await createPurchase(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/vendor/i);
  });

  it("fails with zero quantity", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, quantity: "0" })
    );
    expect(result?.success).toBe(false);
  });

  it("fails with zero rate", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, rateRupees: "0" })
    );
    expect(result?.success).toBe(false);
  });
});

// ─── voidPurchase action tests ────────────────────────────────────────────────

describe("voidPurchase", () => {
  it("voids a wallet-paid purchase and creates a REVERSAL credit", async () => {
    const walletTxnId = "wtxn1";
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur1",
      vendorId: "ven1",
      destinationSiteId: "site1",
      paidByUserId: "emp1",
      totalPaise: 100000n,
      voidedAt: null,
    } as any);
    vi.mocked(db.purchase.update).mockResolvedValue({} as any);
    vi.mocked(db.walletTransaction.findFirst).mockResolvedValue({
      id: walletTxnId,
    } as any);
    vi.mocked(db.walletTransaction.update).mockResolvedValue({} as any);

    const result = await voidPurchase("pur1");

    expect(result.success).toBe(true);

    // Should void the original debit
    expect(vi.mocked(db.walletTransaction.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: walletTxnId } })
    );

    // Should create a REVERSAL credit back
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "emp1",
          type: "REVERSAL",
          direction: "CREDIT",
          amountPaise: 100000n,
        }),
      })
    );
  });

  it("voids owner-direct purchase without touching wallet", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur2",
      vendorId: "ven1",
      destinationSiteId: null,
      paidByUserId: null,
      totalPaise: 50000n,
      voidedAt: null,
    } as any);
    vi.mocked(db.purchase.update).mockResolvedValue({} as any);

    const result = await voidPurchase("pur2");

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
    expect(vi.mocked(db.walletTransaction.update)).not.toHaveBeenCalled();
  });

  it("fails if purchase already voided", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur3",
      voidedAt: new Date(),
    } as any);

    const result = await voidPurchase("pur3");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already voided/i);
  });
});
