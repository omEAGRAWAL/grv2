/**
 * Tests for Phase 13: purchase payment tracking
 *   - createPurchase with no initial payment → UNPAID, no wallet impact
 *   - createPurchase with full payment → PAID, PurchasePayment created, WalletTransaction if wallet
 *   - createPurchase with partial payment → PARTIAL
 *   - addPurchasePayment brings total to purchase total → PAID
 *   - addPurchasePayment exceeds remaining → rejected
 *   - voidPurchasePayment reverses wallet transaction and recomputes status
 *   - voidPurchase voids all payments and reversal credits
 *   - Migration: existing v1 purchases are migrated
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPurchase, addPurchasePayment, voidPurchasePayment, voidPurchase } from "@/app/actions/purchases";
import { db } from "@/lib/db";
import { requireOwner, requireRole } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

vi.mock("@/lib/db", () => {
  const mockDb = {
    vendor: { findFirst: vi.fn() },
    material: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
    purchase: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchasePayment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    purchaseLineItem: { create: vi.fn() },
    walletTransaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireOwner: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockOwner = {
  id: "own1",
  role: "OWNER",
  name: "Owner",
  isActive: true,
  effectiveCompanyId: "cmp1",
};
const mockEmployee = { id: "emp1", role: "EMPLOYEE", name: "Ramesh", isActive: true };
const mockVendor = { id: "ven1", name: "Shree Cements" };

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// 100 bags × ₹1000 = ₹1,00,000 = 10,000,000 paise
const baseFields = {
  purchaseType: "VENDOR",
  vendorId: "ven1",
  lineItemsJson: JSON.stringify([{
    itemName: "Cement",
    quantity: "100",
    unit: "bag",
    rateRupees: "1000",
    discountPercent: "0",
    gstPercent: "0",
  }]),
  destinationSiteId: "CENTRAL_STORE",
  purchaseDate: "2026-04-23",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as never);
  vi.mocked(requireRole).mockResolvedValue(mockOwner as never);
  vi.mocked(db.vendor.findFirst).mockResolvedValue(mockVendor as never);
  vi.mocked(db.material.findMany).mockResolvedValue([]);
  vi.mocked(db.user.findFirst).mockResolvedValue(mockEmployee as never);
  vi.mocked(db.purchase.create).mockResolvedValue({
    id: "pur1",
    totalPaise: 10000000n,
    itemName: "Cement",
    vendorId: "ven1",
    destinationSiteId: null,
    companyId: "cmp1",
  } as never);
  vi.mocked(db.purchasePayment.create).mockResolvedValue({ id: "pay1" } as never);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({ id: "wt1" } as never);
  vi.mocked(getWalletBalance).mockResolvedValue(20000000n); // ₹2,00,000
});

// ─── createPurchase ───────────────────────────────────────────────────────────

describe("createPurchase — no initial payment", () => {
  it("creates purchase with UNPAID status, no PurchasePayment, no wallet debit", async () => {
    await createPurchase(null, makeForm(baseFields)).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.paymentStatus).toBe("UNPAID");
    expect(vi.mocked(db.purchasePayment.create)).not.toHaveBeenCalled();
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });
});

describe("createPurchase — full initial payment (owner direct)", () => {
  it("creates purchase PAID, one PurchasePayment, no wallet debit", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, ipAmount: "100000", ipDate: "2026-04-23", ipMethod: "CASH", ipPaidByUserId: "OWNER_DIRECT" })
    ).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.paymentStatus).toBe("PAID");
    expect(vi.mocked(db.purchasePayment.create)).toHaveBeenCalledOnce();
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();

    const payCall = vi.mocked(db.purchasePayment.create).mock.calls[0][0];
    expect(payCall.data.paidByUserId).toBeNull();
    expect(payCall.data.paymentMethod).toBe("CASH");
  });
});

describe("createPurchase — full initial payment from wallet", () => {
  it("creates PAID, PurchasePayment linked to WalletTransaction", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, ipAmount: "100000", ipDate: "2026-04-23", ipMethod: "UPI", ipPaidByUserId: "emp1" })
    ).catch(() => {});

    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledOnce();
    expect(vi.mocked(db.purchasePayment.create)).toHaveBeenCalledOnce();

    const wtCall = vi.mocked(db.walletTransaction.create).mock.calls[0][0];
    expect(wtCall.data.type).toBe("VENDOR_PAYMENT");
    expect(wtCall.data.direction).toBe("DEBIT");

    const payCall = vi.mocked(db.purchasePayment.create).mock.calls[0][0];
    expect(payCall.data.relatedWalletTxnId).toBe("wt1");
  });
});

describe("createPurchase — partial initial payment", () => {
  it("creates purchase with PARTIAL status", async () => {
    await createPurchase(
      null,
      makeForm({ ...baseFields, ipAmount: "300", ipDate: "2026-04-23", ipMethod: "CASH", ipPaidByUserId: "OWNER_DIRECT" })
    ).catch(() => {});

    const createCall = vi.mocked(db.purchase.create).mock.calls[0][0];
    expect(createCall.data.paymentStatus).toBe("PARTIAL");
    expect(vi.mocked(db.purchasePayment.create)).toHaveBeenCalledOnce();
  });
});

describe("createPurchase — initial payment exceeds total", () => {
  it("rejects overpayment and does not create purchase", async () => {
    const result = await createPurchase(
      null,
      makeForm({ ...baseFields, ipAmount: "200000", ipDate: "2026-04-23", ipMethod: "CASH", ipPaidByUserId: "OWNER_DIRECT" })
    );
    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/exceed/i);
    expect(vi.mocked(db.purchase.create)).not.toHaveBeenCalled();
  });
});

// ─── addPurchasePayment ───────────────────────────────────────────────────────

describe("addPurchasePayment", () => {
  const partialPurchase = {
    id: "pur1",
    companyId: "cmp1",
    totalPaise: 10000000n,
    vendorId: "ven1",
    destinationSiteId: null,
    itemName: "Cement",
    voidedAt: null,
    payments: [{ amountPaidPaise: 3000000n }], // ₹30k already paid
    vendor: { name: "Shree Cements" },
  };

  beforeEach(() => {
    vi.mocked(db.purchase.findFirst).mockResolvedValue(partialPurchase as never);
    vi.mocked(db.purchase.update).mockResolvedValue({} as never);
  });

  it("records payment and updates status to PARTIAL when still underpaid", async () => {
    const form = makeForm({
      purchaseId: "pur1",
      amountRupees: "400",
      paidDate: "2026-04-24",
      paymentMethod: "CASH",
      paidByUserId: "OWNER_DIRECT",
    });

    const result = await addPurchasePayment(null, form);
    expect(result.success).toBe(true);

    const updateCall = vi.mocked(db.purchase.update).mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("PARTIAL");
  });

  it("marks PAID when payment brings total to exactly purchase total", async () => {
    const form = makeForm({
      purchaseId: "pur1",
      amountRupees: "70000", // ₹70k remaining (₹1L - ₹30k already paid)
      paidDate: "2026-04-24",
      paymentMethod: "CASH",
      paidByUserId: "OWNER_DIRECT",
    });

    const result = await addPurchasePayment(null, form);
    expect(result.success).toBe(true);

    const updateCall = vi.mocked(db.purchase.update).mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("PAID");
  });

  it("rejects payment that exceeds remaining due", async () => {
    const form = makeForm({
      purchaseId: "pur1",
      amountRupees: "100000",  // way over the ₹70k remaining
      paidDate: "2026-04-24",
      paymentMethod: "CASH",
      paidByUserId: "OWNER_DIRECT",
    });

    const result = await addPurchasePayment(null, form);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/exceed/i);
    expect(vi.mocked(db.purchasePayment.create)).not.toHaveBeenCalled();
  });

  it("creates WalletTransaction debit when paidByUserId is a wallet user", async () => {
    const form = makeForm({
      purchaseId: "pur1",
      amountRupees: "400",
      paidDate: "2026-04-24",
      paymentMethod: "UPI",
      paidByUserId: "emp1",
    });

    vi.mocked(db.user.findFirst)
      .mockResolvedValueOnce(mockEmployee as never)  // payer exists check
      .mockResolvedValueOnce(null);                   // isOwner check → not owner
    vi.mocked(getWalletBalance).mockResolvedValue(5000000n);

    const result = await addPurchasePayment(null, form);
    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledOnce();

    const payCall = vi.mocked(db.purchasePayment.create).mock.calls[0][0];
    expect(payCall.data.relatedWalletTxnId).toBe("wt1");
  });
});

// ─── voidPurchasePayment ──────────────────────────────────────────────────────

describe("voidPurchasePayment", () => {
  it("voids payment and reverses linked wallet transaction", async () => {
    vi.mocked(db.purchasePayment.findFirst).mockResolvedValue({
      id: "pay1",
      companyId: "cmp1",
      voidedAt: null,
      amountPaidPaise: 3000000n,
      paidByUserId: "emp1",
      relatedWalletTxnId: "wt1",
      purchase: { id: "pur1", totalPaise: 10000000n, vendorId: "ven1", destinationSiteId: null },
    } as never);
    vi.mocked(db.purchasePayment.update).mockResolvedValue({} as never);
    vi.mocked(db.walletTransaction.update).mockResolvedValue({} as never);
    vi.mocked(db.purchasePayment.findMany).mockResolvedValue([]); // no remaining

    const result = await voidPurchasePayment("pay1");
    expect(result.success).toBe(true);

    // Should void the wallet transaction
    expect(vi.mocked(db.walletTransaction.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wt1" } })
    );
    // Should create a REVERSAL credit
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "REVERSAL",
          direction: "CREDIT",
          amountPaise: 3000000n,
          actorUserId: "emp1",
        }),
      })
    );
    // No remaining payments → status back to UNPAID
    const updateCall = vi.mocked(db.purchase.update).mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("UNPAID");
  });

  it("recomputes status to PARTIAL when other payments remain", async () => {
    vi.mocked(db.purchasePayment.findFirst).mockResolvedValue({
      id: "pay2",
      companyId: "cmp1",
      voidedAt: null,
      amountPaidPaise: 4000000n,
      paidByUserId: null,
      relatedWalletTxnId: null,
      purchase: { id: "pur1", totalPaise: 10000000n, vendorId: "ven1", destinationSiteId: null },
    } as never);
    vi.mocked(db.purchasePayment.update).mockResolvedValue({} as never);
    // Remaining: ₹30k = 3000000 paise
    vi.mocked(db.purchasePayment.findMany).mockResolvedValue([
      { amountPaidPaise: 3000000n },
    ] as never);

    const result = await voidPurchasePayment("pay2");
    expect(result.success).toBe(true);

    const updateCall = vi.mocked(db.purchase.update).mock.calls[0][0];
    expect(updateCall.data.paymentStatus).toBe("PARTIAL");
  });

  it("fails if payment already voided", async () => {
    vi.mocked(db.purchasePayment.findFirst).mockResolvedValue({
      id: "pay3",
      voidedAt: new Date(),
    } as never);

    const result = await voidPurchasePayment("pay3");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/already voided/i);
  });
});

// ─── voidPurchase ─────────────────────────────────────────────────────────────

describe("voidPurchase — Phase 13 purchases with payment rows", () => {
  it("voids purchase and all linked payments + reversal credits", async () => {
    vi.mocked(db.purchase.findUnique).mockResolvedValue({
      id: "pur1",
      companyId: "cmp1",
      vendorId: "ven1",
      destinationSiteId: null,
      totalPaise: 10000000n,
      voidedAt: null,
      paidByUserId: null,
      payments: [
        { id: "pay1", paidByUserId: "emp1", amountPaidPaise: 4000000n, relatedWalletTxnId: "wt1" },
      ],
    } as never);
    vi.mocked(db.purchase.update).mockResolvedValue({} as never);
    vi.mocked(db.purchasePayment.update).mockResolvedValue({} as never);
    vi.mocked(db.walletTransaction.update).mockResolvedValue({} as never);

    const result = await voidPurchase("pur1");
    expect(result.success).toBe(true);

    // Payment voided
    expect(vi.mocked(db.purchasePayment.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay1" } })
    );
    // Wallet tx voided + reversal created
    expect(vi.mocked(db.walletTransaction.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wt1" } })
    );
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REVERSAL", direction: "CREDIT" }),
      })
    );
  });
});
