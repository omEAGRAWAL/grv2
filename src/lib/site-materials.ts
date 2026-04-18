import Decimal from "decimal.js";
import { db } from "@/lib/db";

export type AvailableMaterialItem = {
  itemName: string;     // display casing (most recent)
  unit: string;
  totalPurchased: string;    // Decimal string
  totalTransferredIn: string;
  totalTransferredOut: string;
  totalConsumed: string;
  available: string;         // may be negative
  isNegative: boolean;
};

/**
 * Available material at a site, accounting for purchases, transfers, and
 * material consumption records. Allows and flags negative balances.
 *
 * Groups by lowercased+trimmed itemName; display name is the most-recent casing.
 */
export async function getAvailableMaterialV2(siteId: string): Promise<AvailableMaterialItem[]> {
  const [purchases, transfersIn, transfersOut, consumptions] = await Promise.all([
    db.purchase.findMany({
      where: { destinationSiteId: siteId, voidedAt: null },
      select: { itemName: true, unit: true, quantity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.materialTransfer.findMany({
      where: { toSiteId: siteId, voidedAt: null },
      select: { itemName: true, unit: true, quantity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.materialTransfer.findMany({
      where: { fromSiteId: siteId, voidedAt: null },
      select: { itemName: true, unit: true, quantity: true },
    }),
    db.materialConsumption.findMany({
      where: { siteId, voidedAt: null },
      select: { itemName: true, unit: true, quantity: true },
    }),
  ]);

  type Entry = {
    displayName: string;
    unit: string;
    purchased: Decimal;
    transferredIn: Decimal;
    transferredOut: Decimal;
    consumed: Decimal;
  };

  const ledger = new Map<string, Entry>();

  function key(name: string) {
    return name.trim().toLowerCase();
  }

  function ensure(name: string, unit: string, source: { createdAt?: Date }): Entry {
    const k = key(name);
    let entry = ledger.get(k);
    if (!entry) {
      entry = {
        displayName: name,
        unit,
        purchased: new Decimal(0),
        transferredIn: new Decimal(0),
        transferredOut: new Decimal(0),
        consumed: new Decimal(0),
      };
      ledger.set(k, entry);
    }
    // keep most-recent casing (purchases/transfersIn are ordered desc)
    if (source.createdAt) {
      entry.displayName = name;
    }
    return entry;
  }

  for (const p of purchases) {
    const e = ensure(p.itemName, p.unit, p);
    e.purchased = e.purchased.plus(new Decimal(p.quantity.toString()));
  }
  for (const t of transfersIn) {
    const e = ensure(t.itemName, t.unit, t);
    e.transferredIn = e.transferredIn.plus(new Decimal(t.quantity.toString()));
  }
  for (const t of transfersOut) {
    const e = ensure(t.itemName, t.unit, {});
    e.transferredOut = e.transferredOut.plus(new Decimal(t.quantity.toString()));
  }
  for (const c of consumptions) {
    const e = ensure(c.itemName, c.unit, {});
    e.consumed = e.consumed.plus(new Decimal(c.quantity.toString()));
  }

  const result: AvailableMaterialItem[] = [];
  for (const [, e] of ledger.entries()) {
    const available = e.purchased
      .plus(e.transferredIn)
      .minus(e.transferredOut)
      .minus(e.consumed);
    result.push({
      itemName: e.displayName,
      unit: e.unit,
      totalPurchased: e.purchased.toFixed(4),
      totalTransferredIn: e.transferredIn.toFixed(4),
      totalTransferredOut: e.transferredOut.toFixed(4),
      totalConsumed: e.consumed.toFixed(4),
      available: available.toFixed(4),
      isNegative: available.lt(0),
    });
  }

  return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
}
