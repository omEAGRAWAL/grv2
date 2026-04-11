import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMaterialTransfer } from "@/app/actions/material-transfers";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

// Mock the material helper to control available material
vi.mock("@/lib/material", () => ({
  getAvailableMaterial: vi.fn(),
  calcCostMoved: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    materialTransfer: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("next/cache",      () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { getAvailableMaterial, calcCostMoved } from "@/lib/material";

const mockOwner = { id: "own1", role: "OWNER", name: "Owner", isActive: true };

const cementItem = {
  itemName: "Cement 50kg",
  unit: "bags",
  availableQty: "50.0000",
  totalCostPaise: "800000",   // ₹8,000
  avgCostPerUnitPaise: "16000", // ₹160/bag
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(getAvailableMaterial).mockResolvedValue([cementItem]);
  vi.mocked(calcCostMoved).mockImplementation(
    (costStr, availableQtyStr, qtyStr) => {
      // Simple proportional: costStr * qty / availableQty
      const cost = BigInt(costStr);
      const ratio = Number(qtyStr) / Number(availableQtyStr);
      return BigInt(Math.round(Number(cost) * ratio));
    }
  );
  vi.mocked(db.materialTransfer.create).mockResolvedValue({} as any);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const baseFields = {
  fromSourceId:  "site1",
  toSiteId:      "site2",
  itemName:      "Cement 50kg",
  quantity:      "10",
  unit:          "bags",
  transferDate:  "2026-04-01",
};

describe("createMaterialTransfer", () => {
  it("creates a MaterialTransfer row with correct proportional cost", async () => {
    await createMaterialTransfer(null, makeForm(baseFields)).catch(() => {});

    expect(vi.mocked(db.materialTransfer.create)).toHaveBeenCalledTimes(1);

    const createCall = vi.mocked(db.materialTransfer.create).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      fromSiteId: "site1",
      toSiteId: "site2",
      itemName: "Cement 50kg",
      unit: "bags",
    });

    // 10 bags / 50 bags × ₹8,000 = ₹1,600 = 160000n
    expect(createCall.data.costMovedPaise).toBe(160000n);
  });

  it("fails when quantity exceeds available", async () => {
    const result = await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, quantity: "51" }) // 51 > 50 available
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/cannot transfer/i);
    expect(vi.mocked(db.materialTransfer.create)).not.toHaveBeenCalled();
  });

  it("fails when item not available at source", async () => {
    const result = await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, itemName: "Steel Rods", unit: "tons" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/not available/i);
    expect(vi.mocked(db.materialTransfer.create)).not.toHaveBeenCalled();
  });

  it("fails with zero quantity", async () => {
    const result = await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, quantity: "0" })
    );

    expect(result?.success).toBe(false);
  });

  it("fails when from and to are the same location", async () => {
    const result = await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, toSiteId: "site1" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/different/i);
  });

  it("resolves Central Store (fromSourceId=CENTRAL_STORE) to null fromSiteId", async () => {
    await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, fromSourceId: "CENTRAL_STORE" })
    ).catch(() => {});

    const createCall = vi.mocked(db.materialTransfer.create).mock.calls[0][0];
    expect(createCall.data.fromSiteId).toBeNull();
  });

  it("cost moves proportionally — half qty = half cost", async () => {
    // Transfer exactly half the available qty → should move half the cost
    await createMaterialTransfer(
      null,
      makeForm({ ...baseFields, quantity: "25" }) // 25/50 = 50%
    ).catch(() => {});

    const createCall = vi.mocked(db.materialTransfer.create).mock.calls[0][0];
    // 25/50 × 800000 = 400000n
    expect(createCall.data.costMovedPaise).toBe(400000n);
  });
});
