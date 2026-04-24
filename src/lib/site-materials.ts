import Decimal from "decimal.js";
import { getUnscopedDb } from "@/lib/db";

// Scoped by siteId (globally-unique UUID). Callers verify site ownership.
const db = getUnscopedDb();

export type AvailableMaterialItem = {
  itemName: string;
  unit: string;
  totalPurchased: string;
  totalTransferredIn: string;
  totalTransferredOut: string;
  totalConsumed: string;
  available: string;
  isNegative: boolean;
};

type PurchaseWithLineItems = {
  itemName: string | null;
  unit: string | null;
  quantity: { toString: () => string } | null;
  createdAt: Date;
  lineItems: { itemName: string; unit: string; quantity: { toString: () => string } }[];
};

/**
 * Available material at a site, accounting for purchases, transfers, and
 * consumption records. Supports Phase 14 multi-item purchases (lineItems) with
 * backward compatibility for legacy single-item purchases.
 */
export async function getAvailableMaterialV2(siteId: string): Promise<AvailableMaterialItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const [purchases, transfersIn, transfersOut, consumptions] = await Promise.all([
    anyDb.purchase.findMany({
      where: { destinationSiteId: siteId, voidedAt: null },
      select: {
        itemName: true,
        unit: true,
        quantity: true,
        createdAt: true,
        lineItems: {
          select: { itemName: true, unit: true, quantity: true },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<PurchaseWithLineItems[]>,
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
    if (source.createdAt) entry.displayName = name;
    return entry;
  }

  for (const p of purchases) {
    if (p.lineItems.length > 0) {
      // Phase 14: iterate each line item
      for (const li of p.lineItems) {
        const e = ensure(li.itemName, li.unit, { createdAt: p.createdAt });
        e.purchased = e.purchased.plus(new Decimal(li.quantity.toString()));
      }
    } else if (p.itemName && p.quantity && p.unit) {
      // Legacy single-item
      const e = ensure(p.itemName, p.unit, { createdAt: p.createdAt });
      e.purchased = e.purchased.plus(new Decimal(p.quantity.toString()));
    }
  }

  for (const t of transfersIn) {
    const e = ensure(t.itemName, t.unit, { createdAt: t.createdAt });
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
