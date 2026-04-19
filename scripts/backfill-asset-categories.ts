/**
 * One-time backfill: add default AssetCategory rows to every existing company
 * that doesn't already have them.
 *
 * Run after deploying Phase 11 migration:
 *   npx tsx scripts/backfill-asset-categories.ts
 */

import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORY_NAMES } from "../src/lib/assets";

const db = new PrismaClient();

async function main() {
  const companies = await db.company.findMany({ select: { id: true, name: true } });
  console.log(`Found ${companies.length} companies.`);

  let seeded = 0;
  let skipped = 0;

  for (const company of companies) {
    const existing = await db.assetCategory.findMany({
      where: { companyId: company.id, isDefault: true },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c) => c.name));

    const missing = DEFAULT_CATEGORY_NAMES.filter((n) => !existingNames.has(n));
    if (missing.length === 0) {
      console.log(`  ✓ ${company.name} — already has all default categories`);
      skipped++;
      continue;
    }

    await db.assetCategory.createMany({
      data: missing.map((name) => ({
        companyId: company.id,
        name,
        isDefault: true,
      })),
    });
    console.log(`  + ${company.name} — added: ${missing.join(", ")}`);
    seeded++;
  }

  console.log(`\nDone. Seeded: ${seeded} companies, Skipped (already complete): ${skipped}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
