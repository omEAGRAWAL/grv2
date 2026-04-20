import Decimal from "decimal.js";
import { db } from "@/lib/db";

export type AvailableItem = {
  itemName: string;
  unit: string;
  availableQty: string;   // Decimal string (e.g. "12.5000")
  totalCostPaise: string; // BigInt as string
  avgCostPerUnitPaise: string; // BigInt as string (paise per unit)
};

/**
 * Get material available at a given source.
 *
 * @param sourceId - Site ID, or null for "Central Store"
 *
 * Availability = purchases destined here (not voided)
 *              + transfers IN to here (not voided)
 *              - transfers OUT from here (not voided)
 *
 * NOTE: "Central Store" (sourceId = null) cannot receive material transfers
 * (MaterialTransfer.toSiteId is non-nullable — always a real site).
 * So for Central Store: availability = purchases with destinationSiteId IS NULL
 *                                     - transfers OUT with fromSiteId IS NULL
 *
 * Items are grouped by itemName (case-sensitive — v1 limitation, documented).
 * Items with zero or negative availability are excluded.
 */
export async function getAvailableMaterial(
  sourceId: string | null,
  companyId: string
): Promise<AvailableItem[]> {
  // ── 1. Purchases going to this source ────────────────────────────────────
  const purchaseRows = await db.purchase.findMany({
    where: { destinationSiteId: sourceId, companyId, voidedAt: null },
    select: { itemName: true, unit: true, quantity: true, totalPaise: true },
  });

  // ── 2. Material transfers IN to this source (only possible for real sites) ─
  const transfersIn =
    sourceId !== null
      ? await db.materialTransfer.findMany({
          where: { toSiteId: sourceId, companyId, voidedAt: null },
          select: {
            itemName: true,
            unit: true,
            quantity: true,
            costMovedPaise: true,
          },
        })
      : [];

  // ── 3. Material transfers OUT from this source ───────────────────────────
  const transfersOut = await db.materialTransfer.findMany({
    where: { fromSiteId: sourceId, companyId, voidedAt: null },
    select: {
      itemName: true,
      unit: true,
      quantity: true,
      costMovedPaise: true,
    },
  });

  // ── Merge by itemName ─────────────────────────────────────────────────────
  // Map<itemName, { unit, qty: Decimal, costPaise: bigint }>
  const ledger = new Map<
    string,
    { unit: string; qty: Decimal; costPaise: bigint }
  >();

  function credit(
    itemName: string,
    unit: string,
    qty: Decimal,
    costPaise: bigint
  ) {
    const existing = ledger.get(itemName);
    if (existing) {
      existing.qty = existing.qty.plus(qty);
      existing.costPaise += costPaise;
    } else {
      ledger.set(itemName, { unit, qty, costPaise });
    }
  }

  function debit(itemName: string, qty: Decimal, costPaise: bigint) {
    const existing = ledger.get(itemName);
    if (existing) {
      existing.qty = existing.qty.minus(qty);
      existing.costPaise -= costPaise;
    }
    // If no entry exists, it means we're trying to debit something never
    // received — ignore (shouldn't happen in a consistent DB).
  }

  for (const p of purchaseRows) {
    credit(
      p.itemName,
      p.unit,
      new Decimal(p.quantity.toString()),
      p.totalPaise
    );
  }

  for (const t of transfersIn) {
    credit(
      t.itemName,
      t.unit,
      new Decimal(t.quantity.toString()),
      t.costMovedPaise
    );
  }

  for (const t of transfersOut) {
    debit(t.itemName, new Decimal(t.quantity.toString()), t.costMovedPaise);
  }

  // ── Build output (exclude items with zero/negative availability) ──────────
  const result: AvailableItem[] = [];

  for (const [itemName, { unit, qty, costPaise }] of ledger.entries()) {
    if (qty.lte(0) || costPaise <= 0n) continue;

    // Average cost per unit = totalCost / totalQty (rounded to nearest paisa)
    const avgCostPerUnit = new Decimal(costPaise.toString())
      .div(qty)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    result.push({
      itemName,
      unit,
      availableQty: qty.toFixed(4),
      totalCostPaise: costPaise.toString(),
      avgCostPerUnitPaise: avgCostPerUnit.toString(),
    });
  }

  return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/**
 * Compute the proportional cost to move a given quantity of an item.
 *
 * costMoved = availableCostPaise * (qtyToMove / availableQty)
 * Rounded to nearest paisa using ROUND_HALF_UP.
 */
export function calcCostMoved(
  availableCostPaise: string,
  availableQty: string,
  qtyToMove: string
): bigint {
  const cost = new Decimal(availableCostPaise)
    .times(new Decimal(qtyToMove))
    .div(new Decimal(availableQty))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return BigInt(cost.toString());
}
