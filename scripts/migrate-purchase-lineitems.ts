/**
 * Phase 14 data migration: backfill PurchaseLineItem from legacy single-item Purchase rows.
 *
 * Safe to run multiple times (idempotent: skips purchases that already have lineItems).
 *
 * Usage:
 *   npx tsx scripts/migrate-purchase-lineitems.ts
 *   npx tsx scripts/migrate-purchase-lineitems.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Phase 14 purchase line-item migration${DRY_RUN ? " [DRY RUN]" : ""}`);

  // Find all legacy purchases: have itemName set but no lineItems yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchases = await (db as any).purchase.findMany({
    where: {
      itemName: { not: null },
      lineItems: { none: {} },
    },
    select: {
      id: true,
      companyId: true,
      itemName: true,
      quantity: true,
      unit: true,
      ratePaise: true,
      discountPercent: true,
      gstPercent: true,
      totalPaise: true,
    },
  });

  console.log(`Found ${purchases.length} legacy purchase(s) to migrate.`);

  let migrated = 0;
  let skipped = 0;

  for (const p of purchases) {
    if (!p.itemName || p.quantity == null || !p.unit || p.ratePaise == null) {
      console.warn(`  SKIP ${p.id}: missing required legacy fields`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] Would create lineItem for purchase ${p.id}: ${p.itemName} qty=${p.quantity} ${p.unit}`);
      migrated++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).purchaseLineItem.create({
      data: {
        companyId: p.companyId,
        purchaseId: p.id,
        itemName: p.itemName,
        quantity: p.quantity,
        unit: p.unit,
        ratePaise: p.ratePaise,
        discountPercent: p.discountPercent ?? "0",
        gstPercent: p.gstPercent ?? "0",
        lineTotalPaise: p.totalPaise,
        displayOrder: 0,
        materialId: null,
      },
    });
    migrated++;
    process.stdout.write(".");
  }

  if (!DRY_RUN) process.stdout.write("\n");
  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
