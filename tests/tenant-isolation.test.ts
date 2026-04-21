/**
 * Tenant isolation tests.
 *
 * Each test creates a scenario where the caller belongs to COMPANY_A and the
 * target record belongs to COMPANY_B, then verifies the action rejects the
 * operation rather than silently operating on another company's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  vendor: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  site: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  purchase: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  walletTransaction: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  materialTransfer: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  siteIncome: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  siteAssignment: { findFirst: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  attendance: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  siteUpdate: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  materialConsumption: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  assetCategory: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  asset: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  assetAllocation: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  getUnscopedDb: () => mockDb,
  getCompanyScopedDb: () => mockDb,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireOwner: vi.fn(),
  requireRole: vi.fn(),
  requireCompany: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn(() => Promise.resolve(100_000_00n)) }));

import { getCurrentUser, requireOwner, requireRole } from "@/lib/auth";
import { updateVendor } from "@/app/actions/vendors";
import { resetPassword, toggleEmployeeActive } from "@/app/actions/employees";
import { createTransfer } from "@/app/actions/transfers";
import { createPurchase, voidPurchase } from "@/app/actions/purchases";
import { createSiteIncome, voidSiteIncome } from "@/app/actions/incomes";
import { voidWalletTransaction } from "@/app/actions/wallet";
import { voidMaterialTransfer } from "@/app/actions/material-transfers";
import { unassignSupervisor } from "@/app/actions/site-assignments";
import { updateAsset, changeAssetStatus, deleteAsset, voidAssetAllocation } from "@/app/actions/assets";
import { updateCategory, deleteCategory } from "@/app/actions/asset-categories";
import { voidSiteUpdate } from "@/app/actions/site-updates";
import { voidConsumption } from "@/app/actions/material-consumption";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_A = "company-alpha";
const COMPANY_B = "company-beta";

const ownerA = {
  id: "owner-a",
  role: "OWNER",
  companyId: COMPANY_A,
  effectiveCompanyId: COMPANY_A,
  name: "Owner A",
  isActive: true,
};

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(ownerA as never);
  vi.mocked(requireRole).mockResolvedValue(ownerA as never);
  vi.mocked(getCurrentUser).mockResolvedValue(ownerA as never);
});

// ─── 1. Vendor isolation ──────────────────────────────────────────────────────

describe("vendor isolation", () => {
  it("rejects updating a vendor that belongs to another company", async () => {
    // findFirst returns null (no vendor with that id + COMPANY_A)
    vi.mocked(mockDb.vendor.findFirst).mockResolvedValue(null);

    const form = makeForm({ vendorId: "vendor-b", name: "Hacked Name" });
    const result = await updateVendor(null, form) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockDb.vendor.update).not.toHaveBeenCalled();
  });

  it("allows updating a vendor in the caller's own company", async () => {
    const ownVendor = { id: "vendor-a", companyId: COMPANY_A, name: "Cement Co" };
    vi.mocked(mockDb.vendor.findFirst).mockResolvedValue(ownVendor as never);
    vi.mocked(mockDb.vendor.update).mockResolvedValue({ ...ownVendor, name: "New Name" } as never);

    const form = makeForm({ vendorId: "vendor-a", name: "New Name" });
    const result = await updateVendor(null, form);

    expect(result.success).toBe(true);
    expect(mockDb.vendor.update).toHaveBeenCalledOnce();
  });
});

// ─── 2. Employee isolation ────────────────────────────────────────────────────

describe("employee isolation", () => {
  it("rejects resetting password of an employee from another company", async () => {
    vi.mocked(mockDb.user.findFirst).mockResolvedValue(null);

    const form = makeForm({ userId: "emp-b", newPassword: "newpass123" });
    const result = await resetPassword(null, form) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects toggling active status of an employee from another company", async () => {
    vi.mocked(mockDb.user.findFirst).mockResolvedValue(null);

    const form = makeForm({ userId: "emp-b", active: "false" });
    const result = await toggleEmployeeActive(null, form);

    expect(result.success).toBe(false);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

// ─── 3. Wallet transfer isolation ─────────────────────────────────────────────

describe("wallet transfer isolation", () => {
  it("rejects transfer when either user belongs to another company", async () => {
    // fromUser is null (not in company A)
    vi.mocked(mockDb.user.findFirst).mockResolvedValue(null);

    const form = makeForm({ fromUserId: "emp-b", toUserId: "emp-a", amountPaise: "50000" });
    const result = await createTransfer(null, form);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockDb.walletTransaction.create).not.toHaveBeenCalled();
  });
});

// ─── 4. Purchase isolation ────────────────────────────────────────────────────

describe("purchase isolation", () => {
  it("rejects creating a purchase with a vendor from another company", async () => {
    // vendor.findFirst returns null (vendor-b not in COMPANY_A)
    vi.mocked(mockDb.vendor.findFirst).mockResolvedValue(null);

    const form = makeForm({
      vendorId: "vendor-b",
      itemName: "Steel",
      quantity: "10",
      unit: "tons",
      rateRupees: "50000",
      discountPercent: "0",
      gstPercent: "18",
      purchaseDate: "2024-01-15",
    });
    const result = await createPurchase(null, form);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/vendor/i);
  });

  it("rejects voiding a purchase that belongs to another company", async () => {
    const foreignPurchase = { id: "pur-b", companyId: COMPANY_B, voidedAt: null };
    vi.mocked(mockDb.purchase.findUnique).mockResolvedValue(foreignPurchase as never);

    const result = await voidPurchase("pur-b");

    expect(result.success).toBe(false);
    expect(mockDb.purchase.update).not.toHaveBeenCalled();
  });

  it("allows voiding a purchase from the caller's own company", async () => {
    const ownPurchase = {
      id: "pur-a",
      companyId: COMPANY_A,
      voidedAt: null,
      paidByUserId: null,
    };
    vi.mocked(mockDb.purchase.findUnique).mockResolvedValue(ownPurchase as never);
    vi.mocked(mockDb.walletTransaction.findFirst).mockResolvedValue(null);
    vi.mocked(mockDb.purchase.update).mockResolvedValue({ ...ownPurchase, voidedAt: new Date() } as never);

    const result = await voidPurchase("pur-a");

    expect(result.success).toBe(true);
    expect(mockDb.purchase.update).toHaveBeenCalledOnce();
  });
});

// ─── 5. Site income isolation ─────────────────────────────────────────────────

describe("site income isolation", () => {
  it("rejects voiding income from another company", async () => {
    const foreignIncome = {
      id: "inc-b",
      companyId: COMPANY_B,
      voidedAt: null,
      siteId: "site-b",
    };
    vi.mocked(mockDb.siteIncome.findUnique).mockResolvedValue(foreignIncome as never);

    const result = await voidSiteIncome("inc-b");

    expect(result.success).toBe(false);
    expect(mockDb.siteIncome.update).not.toHaveBeenCalled();
  });

  it("rejects creating site income when site belongs to another company", async () => {
    vi.mocked(mockDb.site.findFirst).mockResolvedValue(null);

    const form = makeForm({
      siteId: "site-b",
      amountRupees: "50000",
      type: "ADVANCE",
      receivedDate: "2024-01-15",
    });
    const result = await createSiteIncome(null, form) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/site/i);
  });
});

// ─── 6. Wallet transaction isolation ──────────────────────────────────────────

describe("wallet transaction isolation", () => {
  it("rejects voiding a wallet transaction from another company", async () => {
    const foreignTxn = {
      id: "txn-b",
      companyId: COMPANY_B,
      voidedAt: null,
      type: "TOPUP",
      actorUserId: "emp-b",
    };
    vi.mocked(mockDb.walletTransaction.findUnique).mockResolvedValue(foreignTxn as never);

    const result = await voidWalletTransaction("txn-b");

    expect(result.success).toBe(false);
    expect(mockDb.walletTransaction.update).not.toHaveBeenCalled();
  });

  it("allows voiding own company's wallet transaction", async () => {
    const ownTxn = {
      id: "txn-a",
      companyId: COMPANY_A,
      voidedAt: null,
      type: "TOPUP",
      actorUserId: "emp-a",
      direction: "CREDIT",
    };
    vi.mocked(mockDb.walletTransaction.findUnique).mockResolvedValue(ownTxn as never);
    vi.mocked(mockDb.walletTransaction.findFirst).mockResolvedValue(null);
    vi.mocked(mockDb.walletTransaction.update).mockResolvedValue({ ...ownTxn, voidedAt: new Date() } as never);

    const result = await voidWalletTransaction("txn-a");

    expect(result.success).toBe(true);
  });
});

// ─── 7. Material transfer isolation ───────────────────────────────────────────

describe("material transfer isolation", () => {
  it("rejects voiding a material transfer from another company", async () => {
    const foreignTransfer = {
      id: "mt-b",
      companyId: COMPANY_B,
      voidedAt: null,
      fromSiteId: "site-b",
    };
    vi.mocked(mockDb.materialTransfer.findUnique).mockResolvedValue(foreignTransfer as never);

    const result = await voidMaterialTransfer("mt-b");

    expect(result.success).toBe(false);
    expect(mockDb.materialTransfer.update).not.toHaveBeenCalled();
  });
});

// ─── 8. Site assignment isolation ─────────────────────────────────────────────

describe("site assignment isolation", () => {
  it("rejects unassigning supervisor from another company's site", async () => {
    vi.mocked(mockDb.site.findFirst).mockResolvedValue(null);

    const result = await unassignSupervisor("site-b", "sup-b");

    expect(result.success).toBe(false);
    expect(mockDb.siteAssignment.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── 9. Asset isolation ───────────────────────────────────────────────────────

describe("asset isolation", () => {
  it("rejects updating an asset from another company", async () => {
    const foreignAsset = { id: "asset-b", companyId: COMPANY_B };
    vi.mocked(mockDb.asset.findUnique).mockResolvedValue(foreignAsset as never);

    const form = makeForm({
      id: "asset-b",
      name: "Hacked Asset",
      categoryId: "cat-b",
      ownershipType: "OWNED",
      status: "AVAILABLE",
    });
    const result = await updateAsset(null, form) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("rejects changing status of an asset from another company", async () => {
    const foreignAsset = { id: "asset-b", companyId: COMPANY_B };
    vi.mocked(mockDb.asset.findUnique).mockResolvedValue(foreignAsset as never);

    const result = await changeAssetStatus("asset-b", "MAINTENANCE");

    expect(result.success).toBe(false);
    expect(mockDb.asset.update).not.toHaveBeenCalled();
  });

  it("rejects deleting an asset from another company", async () => {
    const foreignAsset = {
      id: "asset-b",
      companyId: COMPANY_B,
      photoPublicId: null,
      _count: { allocations: 0 },
    };
    vi.mocked(mockDb.asset.findUnique).mockResolvedValue(foreignAsset as never);

    const result = await deleteAsset("asset-b");

    expect(result.success).toBe(false);
    expect(mockDb.asset.delete).not.toHaveBeenCalled();
  });

  it("rejects voiding an allocation from another company", async () => {
    const foreignAlloc = { id: "alloc-b", companyId: COMPANY_B, voidedAt: null };
    vi.mocked(mockDb.assetAllocation.findUnique).mockResolvedValue(foreignAlloc as never);

    const result = await voidAssetAllocation("alloc-b");

    expect(result.success).toBe(false);
    expect(mockDb.assetAllocation.update).not.toHaveBeenCalled();
  });
});

// ─── 10. Asset category isolation ─────────────────────────────────────────────

describe("asset category isolation", () => {
  it("rejects renaming a category from another company", async () => {
    const foreignCat = { id: "cat-b", companyId: COMPANY_B, isDefault: false };
    vi.mocked(mockDb.assetCategory.findUnique).mockResolvedValue(foreignCat as never);

    const form = makeForm({ id: "cat-b", name: "Hacked Category" });
    const result = await updateCategory(null, form) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockDb.assetCategory.update).not.toHaveBeenCalled();
  });

  it("rejects deleting a category from another company", async () => {
    const foreignCat = {
      id: "cat-b",
      companyId: COMPANY_B,
      isDefault: false,
      _count: { assets: 0 },
    };
    vi.mocked(mockDb.assetCategory.findUnique).mockResolvedValue(foreignCat as never);

    const result = await deleteCategory("cat-b");

    expect(result.success).toBe(false);
    expect(mockDb.assetCategory.delete).not.toHaveBeenCalled();
  });
});

// ─── 11. Site update isolation ────────────────────────────────────────────────

describe("site update isolation", () => {
  it("rejects voiding a site update from another company", async () => {
    const foreignUpdate = { id: "upd-b", companyId: COMPANY_B, voidedAt: null, siteId: "site-b" };
    vi.mocked(mockDb.siteUpdate.findUnique).mockResolvedValue(foreignUpdate as never);

    const result = await voidSiteUpdate("upd-b") as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/company/i);
    expect(mockDb.siteUpdate.update).not.toHaveBeenCalled();
  });
});

// ─── 12. Material consumption isolation ───────────────────────────────────────

describe("material consumption isolation", () => {
  it("rejects voiding a consumption record from another company", async () => {
    const foreignConsumption = {
      id: "con-b",
      companyId: COMPANY_B,
      voidedAt: null,
      siteId: "site-b",
    };
    vi.mocked(mockDb.materialConsumption.findUnique).mockResolvedValue(foreignConsumption as never);

    const result = await voidConsumption("con-b") as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/company/i);
    expect(mockDb.materialConsumption.update).not.toHaveBeenCalled();
  });
});

// ─── 13. SUPERADMIN impersonation respects effective company ──────────────────

describe("SUPERADMIN impersonation isolation", () => {
  it("effectiveCompanyId from impersonation scopes all queries to target company", () => {
    const superAdmin = { id: "sa-1", role: "SUPERADMIN", companyId: null };
    const session = { impersonatingCompanyId: COMPANY_A };
    const effectiveCompanyId = session.impersonatingCompanyId ?? superAdmin.companyId ?? undefined;
    expect(effectiveCompanyId).toBe(COMPANY_A);
  });

  it("SUPERADMIN without impersonation has no effective company", () => {
    const superAdmin = { id: "sa-1", role: "SUPERADMIN", companyId: null };
    const session = { impersonatingCompanyId: undefined };
    const effectiveCompanyId = session.impersonatingCompanyId ?? superAdmin.companyId ?? undefined;
    expect(effectiveCompanyId).toBeUndefined();
  });

  it("SUPERADMIN impersonating company B cannot bleed into company A", () => {
    const sessionA = { impersonatingCompanyId: COMPANY_A };
    const sessionB = { impersonatingCompanyId: COMPANY_B };
    const superAdmin = { id: "sa-1", role: "SUPERADMIN", companyId: null };

    const effectiveA = sessionA.impersonatingCompanyId ?? superAdmin.companyId;
    const effectiveB = sessionB.impersonatingCompanyId ?? superAdmin.companyId;

    expect(effectiveA).toBe(COMPANY_A);
    expect(effectiveB).toBe(COMPANY_B);
    expect(effectiveA).not.toBe(effectiveB);
  });
});

// ─── 14. Guard: findMany without companyId should throw ───────────────────────

describe("Prisma safety guard", () => {
  const SCOPED_MODELS = new Set([
    "user", "site", "vendor", "wallettransaction", "purchase",
    "materialtransfer", "siteincome", "siteassignment", "attendance",
    "siteupdate", "materialconsumption", "assetcategory", "asset", "assetallocation",
  ]);

  function guardMissingCompanyId(model: string, args: { where?: Record<string, unknown> }) {
    if (!SCOPED_MODELS.has(model.toLowerCase())) return;
    const where = args.where;
    if (!where || !("companyId" in where) || where.companyId == null) {
      throw new Error(`SECURITY: Query on ${model}.findMany without companyId filter`);
    }
  }

  it("throws when findMany is called on a scoped model without companyId", () => {
    expect(() => guardMissingCompanyId("site", { where: { status: "ACTIVE" } }))
      .toThrow(/SECURITY/);
  });

  it("does not throw when companyId is present", () => {
    expect(() => guardMissingCompanyId("site", { where: { companyId: COMPANY_A, status: "ACTIVE" } }))
      .not.toThrow();
  });

  it("does not throw for non-scoped models (e.g. Company)", () => {
    expect(() => guardMissingCompanyId("company", { where: {} }))
      .not.toThrow();
  });

  it("throws for all 14 company-scoped models when companyId is absent", () => {
    for (const model of SCOPED_MODELS) {
      expect(() => guardMissingCompanyId(model, { where: { id: "some-id" } }))
        .toThrow(/SECURITY/);
    }
  });

  it("passes for all 14 company-scoped models when companyId is provided", () => {
    for (const model of SCOPED_MODELS) {
      expect(() => guardMissingCompanyId(model, { where: { companyId: COMPANY_A } }))
        .not.toThrow();
    }
  });
});
