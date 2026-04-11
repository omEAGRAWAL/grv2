import { db } from "@/lib/db";

// ─── Income helpers ───────────────────────────────────────────────────────────

/**
 * Total client payments received for a site (non-voided SiteIncome rows).
 */
export async function getSiteIncome(siteId: string): Promise<bigint> {
  const agg = await db.siteIncome.aggregate({
    _sum: { amountPaise: true },
    where: { siteId, voidedAt: null },
  });
  return agg._sum.amountPaise ?? 0n;
}

/**
 * Batch version of getSiteIncome — 1 query regardless of site count.
 */
export async function getBatchSiteIncome(
  siteIds: string[]
): Promise<Map<string, bigint>> {
  if (siteIds.length === 0) return new Map();
  const rows = await db.siteIncome.groupBy({
    by: ["siteId"],
    _sum: { amountPaise: true },
    where: { siteId: { in: siteIds }, voidedAt: null },
  });
  const map = new Map<string, bigint>();
  for (const r of rows) {
    map.set(r.siteId, r._sum.amountPaise ?? 0n);
  }
  return map;
}

/**
 * Full per-site P&L: received, spent, pnl, budgetUsedPercent.
 * getSiteSpend and getSiteIncome run in parallel.
 */
export async function getSitePnL(
  siteId: string,
  contractValuePaise: bigint
): Promise<{
  received: bigint;
  spent: bigint;
  pnl: bigint;
  budgetUsedPercent: number;
}> {
  const [received, spent] = await Promise.all([
    getSiteIncome(siteId),
    getSiteSpend(siteId),
  ]);
  const pnl = received - spent;
  const budgetUsedPercent =
    contractValuePaise > 0n
      ? Number((spent * 10000n) / contractValuePaise) / 100
      : 0;
  return { received, spent, pnl, budgetUsedPercent };
}

// ─── Spend helpers ────────────────────────────────────────────────────────────

/**
 * Compute the total spend for a single site.
 *
 * The spend is the sum of four components:
 *
 * A) Wallet DEBIT transactions (EXPENSE + VENDOR_PAYMENT) linked to this site.
 *    This covers:
 *    - Expenses logged by employees or owners
 *    - Vendor purchases paid via an employee's wallet (those create a
 *      VENDOR_PAYMENT wallet transaction in addition to a Purchase row)
 *
 * B) Owner-direct purchases (paidByUserId IS NULL) destined for this site.
 *    Owner-direct purchases have no wallet impact, so we count the purchase
 *    total directly. We must NOT count wallet-paid purchases here because
 *    they are already captured in component A.
 *
 * C) Material transfers IN to this site (increases cost, material arrived).
 *
 * D) Material transfers OUT from this site (decreases cost, material left).
 *
 * Net formula: spend = A + B + C - D
 */
export async function getSiteSpend(siteId: string): Promise<bigint> {
  const [walletAgg, purchaseAgg, transferInAgg, transferOutAgg] =
    await Promise.all([
      // A: wallet DEBIT transactions (EXPENSE + VENDOR_PAYMENT)
      db.walletTransaction.aggregate({
        _sum: { amountPaise: true },
        where: {
          siteId,
          type: { in: ["EXPENSE", "VENDOR_PAYMENT"] },
          direction: "DEBIT",
          voidedAt: null,
        },
      }),

      // B: owner-direct purchases (no wallet transaction was created)
      db.purchase.aggregate({
        _sum: { totalPaise: true },
        where: {
          destinationSiteId: siteId,
          paidByUserId: null, // only owner-direct; wallet-paid are in A
          voidedAt: null,
        },
      }),

      // C: material transferred IN to this site (cost added)
      db.materialTransfer.aggregate({
        _sum: { costMovedPaise: true },
        where: { toSiteId: siteId, voidedAt: null },
      }),

      // D: material transferred OUT from this site (cost subtracted)
      db.materialTransfer.aggregate({
        _sum: { costMovedPaise: true },
        where: { fromSiteId: siteId, voidedAt: null },
      }),
    ]);

  const A = walletAgg._sum.amountPaise ?? 0n;
  const B = purchaseAgg._sum.totalPaise ?? 0n;
  const C = transferInAgg._sum.costMovedPaise ?? 0n;
  const D = transferOutAgg._sum.costMovedPaise ?? 0n;

  return A + B + C - D;
}

/**
 * Batch version of getSiteSpend for the sites list page.
 * Uses 4 groupBy queries (regardless of site count) to avoid N+1 problems.
 *
 * Returns a Map<siteId, totalSpendPaise>.
 */
export async function getBatchSiteSpend(
  siteIds: string[]
): Promise<Map<string, bigint>> {
  if (siteIds.length === 0) return new Map();

  const [walletAggs, purchaseAggs, transferInAggs, transferOutAggs] =
    await Promise.all([
      // A: wallet DEBIT transactions per site
      db.walletTransaction.groupBy({
        by: ["siteId"],
        _sum: { amountPaise: true },
        where: {
          siteId: { in: siteIds },
          type: { in: ["EXPENSE", "VENDOR_PAYMENT"] },
          direction: "DEBIT",
          voidedAt: null,
        },
      }),

      // B: owner-direct purchases per site
      db.purchase.groupBy({
        by: ["destinationSiteId"],
        _sum: { totalPaise: true },
        where: {
          destinationSiteId: { in: siteIds },
          paidByUserId: null,
          voidedAt: null,
        },
      }),

      // C: material transfers in per site
      db.materialTransfer.groupBy({
        by: ["toSiteId"],
        _sum: { costMovedPaise: true },
        where: { toSiteId: { in: siteIds }, voidedAt: null },
      }),

      // D: material transfers out per site
      db.materialTransfer.groupBy({
        by: ["fromSiteId"],
        _sum: { costMovedPaise: true },
        where: { fromSiteId: { in: siteIds }, voidedAt: null },
      }),
    ]);

  // Build O(1) lookup maps
  const walletMap = new Map(
    walletAggs.map((r) => [r.siteId!, r._sum.amountPaise ?? 0n])
  );
  const purchaseMap = new Map(
    purchaseAggs.map((r) => [r.destinationSiteId!, r._sum.totalPaise ?? 0n])
  );
  const transferInMap = new Map(
    transferInAggs.map((r) => [r.toSiteId, r._sum.costMovedPaise ?? 0n])
  );
  const transferOutMap = new Map(
    transferOutAggs.map((r) => [r.fromSiteId!, r._sum.costMovedPaise ?? 0n])
  );

  const result = new Map<string, bigint>();
  for (const siteId of siteIds) {
    const A = walletMap.get(siteId) ?? 0n;
    const B = purchaseMap.get(siteId) ?? 0n;
    const C = transferInMap.get(siteId) ?? 0n;
    const D = transferOutMap.get(siteId) ?? 0n;
    result.set(siteId, A + B + C - D);
  }
  return result;
}
