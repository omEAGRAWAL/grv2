import { differenceInCalendarDays, subDays } from "date-fns";
import { getUnscopedDb } from "@/lib/db";
import type { Asset, AssetAllocation } from "@prisma/client";

// Scoped by assetId/siteId (globally-unique UUIDs). Callers verify ownership.
const db = getUnscopedDb();

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurrentLocation = {
  siteId: string | null;
  site: { id: string; name: string } | null;
  allocation: AssetAllocation | null;
};

// ─── 1. getCurrentLocation ────────────────────────────────────────────────────

export async function getCurrentLocation(assetId: string): Promise<CurrentLocation> {
  const allocation = await db.assetAllocation.findFirst({
    where: { assetId, endDate: null, voidedAt: null },
    include: { site: { select: { id: true, name: true } } },
  });
  if (!allocation) return { siteId: null, site: null, allocation: null };
  return {
    siteId: allocation.siteId,
    site: (allocation as typeof allocation & { site: { id: string; name: string } | null }).site,
    allocation,
  };
}

// ─── 2. getEffectiveDailyCost ─────────────────────────────────────────────────

export function getEffectiveDailyCost(
  allocation: Pick<AssetAllocation, "dailyCostPaise">,
  asset: Pick<Asset, "defaultDailyCostPaise">
): bigint | null {
  if (allocation.dailyCostPaise !== null && allocation.dailyCostPaise !== undefined) {
    return allocation.dailyCostPaise;
  }
  if (asset.defaultDailyCostPaise !== null && asset.defaultDailyCostPaise !== undefined) {
    return asset.defaultDailyCostPaise;
  }
  return null;
}

// ─── 3. getAllocationDays ─────────────────────────────────────────────────────

export function getAllocationDays(
  allocation: Pick<AssetAllocation, "startDate" | "endDate">,
  asOfDate: Date = new Date()
): number {
  const start = new Date(allocation.startDate);
  const end = allocation.endDate ? new Date(allocation.endDate) : asOfDate;
  // Clamp end to asOfDate for open allocations
  const effectiveEnd = end > asOfDate ? asOfDate : end;
  if (start > effectiveEnd) return 0;
  // differenceInCalendarDays(end, start) gives (end - start) days; +1 for inclusive
  return differenceInCalendarDays(effectiveEnd, start) + 1;
}

// ─── 4. getAllocationCostPaise ────────────────────────────────────────────────

export function getAllocationCostPaise(
  allocation: Pick<AssetAllocation, "startDate" | "endDate" | "dailyCostPaise" | "includeInSiteCost" | "voidedAt">,
  asset: Pick<Asset, "defaultDailyCostPaise">,
  asOfDate: Date = new Date()
): bigint {
  if (allocation.voidedAt !== null && allocation.voidedAt !== undefined) return 0n;
  if (!allocation.includeInSiteCost) return 0n;
  const rate = getEffectiveDailyCost(allocation, asset);
  if (rate === null) return 0n;
  const days = getAllocationDays(allocation, asOfDate);
  return rate * BigInt(days);
}

// ─── 5. getAssetCostForSite ───────────────────────────────────────────────────

export async function getAssetCostForSite(
  siteId: string,
  asOfDate: Date = new Date()
): Promise<bigint> {
  const allocations = await db.assetAllocation.findMany({
    where: {
      siteId,
      startDate: { lte: asOfDate },
      voidedAt: null,
      includeInSiteCost: true,
    },
    include: { asset: { select: { defaultDailyCostPaise: true } } },
  });

  let total = 0n;
  for (const alloc of allocations) {
    total += getAllocationCostPaise(alloc, alloc.asset, asOfDate);
  }
  return total;
}

// ─── 6. getIdleAssets ────────────────────────────────────────────────────────

export async function getIdleAssets(
  companyId: string,
  daysThreshold = 5
): Promise<(Asset & { category: { name: string }; lastSiteName: string | null; idleDays: number })[]> {
  const thresholdDate = subDays(new Date(), daysThreshold);

  // Load all non-decommissioned, non-maintenance assets for the company
  const assets = await db.asset.findMany({
    where: {
      companyId,
      status: { notIn: ["DECOMMISSIONED", "MAINTENANCE"] },
    },
    include: {
      category: { select: { name: true } },
      allocations: {
        where: { voidedAt: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          endDate: true,
          startDate: true,
          siteId: true,
          site: { select: { name: true } },
        },
      },
    },
  });

  const idleAssets: (Asset & { category: { name: string }; lastSiteName: string | null; idleDays: number })[] = [];

  for (const asset of assets) {
    const latestAlloc = asset.allocations[0];

    // Has an open allocation → not idle
    if (latestAlloc && latestAlloc.endDate === null) continue;

    // No allocations at all — check createdAt
    if (!latestAlloc) {
      if (asset.createdAt <= thresholdDate) {
        idleAssets.push({ ...asset, lastSiteName: null, idleDays: differenceInCalendarDays(new Date(), asset.createdAt) });
      }
      continue;
    }

    // Has a closed allocation — check if it ended more than daysThreshold days ago
    const closedEnd = new Date(latestAlloc.endDate!);
    if (closedEnd <= thresholdDate) {
      idleAssets.push({
        ...asset,
        lastSiteName: (latestAlloc.site as { name: string } | null)?.name ?? null,
        idleDays: differenceInCalendarDays(new Date(), closedEnd),
      });
    }
  }

  return idleAssets;
}

// ─── 7. createAllocation ─────────────────────────────────────────────────────

export type CreateAllocationInput = {
  assetId: string;
  siteId: string | null;
  startDate: Date;
  dailyCostPaise: bigint | null;
  includeInSiteCost: boolean;
  notes: string | null;
  loggedById: string;
  companyId: string;
};

export async function createAllocation(input: CreateAllocationInput): Promise<AssetAllocation> {
  return db.$transaction(async (tx) => {
    // Verify asset belongs to this company
    const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
    if (!asset || asset.companyId !== input.companyId) {
      throw new Error("Asset not found");
    }
    if (asset.status === "DECOMMISSIONED") {
      throw new Error("Cannot allocate a decommissioned asset");
    }

    // Find existing open allocation
    const openAllocation = await tx.assetAllocation.findFirst({
      where: { assetId: input.assetId, endDate: null, voidedAt: null },
    });

    if (openAllocation) {
      const openStart = new Date(openAllocation.startDate);
      if (openStart >= input.startDate) {
        throw new Error(
          "Cannot create allocation; existing open allocation starts on or after your new start date. Void the existing one first."
        );
      }
      // Close the open allocation with endDate = startDate - 1 day
      const closeDate = subDays(input.startDate, 1);
      await tx.assetAllocation.update({
        where: { id: openAllocation.id },
        data: { endDate: closeDate },
      });
    }

    return tx.assetAllocation.create({
      data: {
        companyId: input.companyId,
        assetId: input.assetId,
        siteId: input.siteId,
        startDate: input.startDate,
        endDate: null,
        dailyCostPaise: input.dailyCostPaise,
        includeInSiteCost: input.includeInSiteCost,
        notes: input.notes,
        loggedById: input.loggedById,
      },
    });
  });
}

// ─── Default category names ───────────────────────────────────────────────────

export const DEFAULT_CATEGORY_NAMES = [
  "Vehicles",
  "Heavy Machinery",
  "Generators",
  "Centering/Shuttering",
  "Tools",
  "Scaffolding",
  "Tankers",
  "Other",
] as const;
