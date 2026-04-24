import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPurchase, voidPurchase } from "@/app/actions/purchases";
import { calcPurchaseTotalPaise } from "@/lib/purchase-math";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

vi.mock("@/lib/db", () => {
  const mockDb = {
    vendor: { findFirst: vi.fn() },
    material: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
    purchase: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    purchasePayment: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    purchaseLineItem: { create: vi.fn() },
    walletTransaction: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireOwner: vi.fn(),
}));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockOwner = { id: "own1", role: "OWNER", name: "Owner", isActive: true, effectiveCompanyId: "cmp1" };
const mockEmployee = { id: "emp1", role: "EMPLOYEE", name: "Ramesh", isActive: true };
const mockVendor = { id: "ven1", name: "Shree Cements" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function makeLineItem(overrides: Record<string, string> = {}) {
  return {
    itemName: "Cement 50kg",
    quantity: "100",
    unit: "bags",
    rateRupees: "350",
    discountPercent: "0",
    gstPercent: "18",
    ...overrides,
  };
}

// 100 bags × ₹350 × 1.18 = ₹41,300 = 4,130,000 paise
const baseFields = {
  purchaseType: "VENDOR",
  vendorId: "ven1",
  lineItemsJson: JSON.stringify([makeLineItem()]),
  destinationSiteId: "site1",
  purchaseDate: "2026-04-01",
  ipAmount: "41300",
  ipDate: "2026-04-01",
  ipMethod: "CASH",
  ipPaidByUserId: "emp1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(db.vendor.findFirst).mockResolvedValue(mockVendor as any);
  vi.mocked(db.material.findMany).mockResolvedValue([]);
  vi.mocked(db.user.findFirst).mockResolvedValue(mockEmployee as any);
  vi.mocked(db.purchase.create).mockResolvedValue({ id: "pur1", totalPaise: 4130000n } as any);
  vi.mocked(db.purchase.findUnique).mockResolvedValue(null);
  vi.mocked(db.purchasePayment.create).mockResolvedValue({ id: "pay1" } as any);
  vi.mocked(db.purchaseLineItem.create).mockResolvedValue({ id: "li1" } as any);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({ id: "wt1" } as any);
  vi.mocked(db.walletTransaction.findFirst).mockResolvedValue(null);
  vi.mocked(getWalletBalance).mockResolvedValue(10000000n); // ₹1,00,000
});

// ─── calcPurchaseTotalPaise unit tests ────────────────────────────────────────

describe("calcPurchaseTotalPaise", () => {
  it("qty × rate, no discount, no GST", () => {
    expect(calcPurchaseTotalPaise("10", 10000n, "0", "0")).toBe(100000n);
  });

  it("applies discount correctly (10% off)", () => {
    expect(calcPurchaseTotalPaise("10", 10000n, "10", "0")).toBe(90000n);
  });

  it("applies GST correctly (18% GST, no discount)", () => {
    expect(calcPurchaseTotalPaise("10", 10000n, "0", "18")).toBe(118000n);
  });

  it("applies discount + GST correctly", () => {
    // 2.5 × 10000 = 25000; disc 10% = 2500; after = 22500; gst 18% = 4050; total = 26550
    expect(calcPurchaseTotalPaise("2.5", 10000n, "10", "18")).toBe(26550n);
  });

  it("handles fractional quantity", () => {
    expect(calcPurchaseTotalPaise("1.5", 5000n, "0", "0")).toBe(7500n);
  });

  it("rounds to nearest paise (ROUND_HALF_UP)", () => {
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

  it("creates line items via purchaseLineItem.create", async () => {
    await createPurchase(null, makeForm(baseFields)).catch(() => {});

    expect(vi.mocked(db.purchaseLineItem.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.purchaseLineItem.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemName: "Cement 50kg",
          unit: "bags",
        }),
      })
    );
  });

  it("creates multi-item purchase with correct totalPaise", async () => {
    // 2 items: 100 bags × ₹350 × 1.18 = ₹41,300 and 50 bags × ₹200 × 1.18 = ₹11,800
    const lineItems = JSON.stringify([
      makeLineItem({ quantity: "100", rateRupees: "350" }),
      makeLineItem({ itemName: "Sand", quantity: "50", rateRupees: "200", unit: "cft" }),
    ]);
    await createPurchase(
      null,
      makeForm({ ...baseFields, lineItemsJson: lineItems, ipAmount: "53100" })
    ).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    // 4130000 + 1180000 = 5310000 paise
    expect(createCall.data.totalPaise).toBe(5310000n);
    expect(vi.mocked(db.purchaseLineItem.create)).toHaveBeenCalledTimes(2);
  });

  it("creates LOCAL purchase without vendorId", async () => {
    const localFields = {
      purchaseType: "LOCAL",
      sellerName: "Local hardware shop",
      lineItemsJson: JSON.stringify([makeLineItem()]),
      destinationSiteId: "site1",
      purchaseDate: "2026-04-01",
    };
    await createPurchase(null, makeForm(localFields)).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.purchaseType).toBe("LOCAL");
    expect(createCall.data.vendorId).toBeNull();
    expect(createCall.data.sellerName).toBe("Local hardware shop");
    expect(vi.mocked(db.vendor.findFirst)).not.toHaveBeenCalled();
  });

  it("creates purchase with correct server-computed totalPaise", async () => {
    await createPurchase(null, makeForm(baseFields)).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.totalPaise).toBe(4130000n);
  });

  it("does NOT create wallet txn when owner-direct", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, ipPaidByUserId: "OWNER_DIRECT" })
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

  it("fails with insufficient balance", async () => {
    vi.mocked(getWalletBalance).mockResolvedValue(100n);

    const result = await createPurchase(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/insufficient/i);
    expect(vi.mocked(db.purchase.create)).not.toHaveBeenCalled();
  });

  it("fails when vendor not found", async () => {
    vi.mocked(db.vendor.findFirst).mockResolvedValue(null);

    const result = await createPurchase(null, makeForm(baseFields));

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/vendor/i);
  });

  it("fails with zero quantity in line item", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, lineItemsJson: JSON.stringify([makeLineItem({ quantity: "0" })]) })
    );
    expect(result?.success).toBe(false);
  });

  it("fails with zero rate in line item", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, lineItemsJson: JSON.stringify([makeLineItem({ rateRupees: "0" })]) })
    );
    expect(result?.success).toBe(false);
  });

  it("fails when lineItemsJson is empty array", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, lineItemsJson: "[]" })
    );
    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/at least one/i);
  });

  it("fails when VENDOR type has no vendorId", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, vendorId: "" })
    );
    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/vendor/i);
  });
});

// ─── voidPurchase action tests ────────────────────────────────────────────────

describe("voidPurchase", () => {
  it("voids a wallet-paid purchase and creates a REVERSAL credit", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur1",
      companyId: "cmp1",
      vendorId: "ven1",
      destinationSiteId: "site1",
      paidByUserId: "emp1",
      totalPaise: 100000n,
      voidedAt: null,
      payments: [],
    } as any);
    vi.mocked(db.purchase.update).mockResolvedValue({} as any);
    vi.mocked(db.walletTransaction.findFirst).mockResolvedValue({ id: "wtxn1" } as any);
    vi.mocked(db.walletTransaction.update).mockResolvedValue({} as any);

    const result = await voidPurchase("pur1");

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wtxn1" } })
    );
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
      companyId: "cmp1",
      vendorId: "ven1",
      destinationSiteId: null,
      paidByUserId: null,
      totalPaise: 50000n,
      voidedAt: null,
      payments: [],
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
      companyId: "cmp1",
      voidedAt: new Date(),
      payments: [],
    } as any);

    const result = await voidPurchase("pur3");

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/already voided/i);
  });

  it("voids LOCAL purchase (null vendorId) without vendor revalidatePath", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur4",
      companyId: "cmp1",
      vendorId: null,
      destinationSiteId: null,
      paidByUserId: null,
      totalPaise: 50000n,
      voidedAt: null,
      payments: [],
    } as any);
    vi.mocked(db.purchase.update).mockResolvedValue({} as any);

    const result = await voidPurchase("pur4");
    expect(result.success).toBe(true);
  });
});
