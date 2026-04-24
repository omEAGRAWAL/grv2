/**
 * Backfill default materials for existing companies that predate Phase 13.
 *
 * Safe to run multiple times — skips companies that already have materials.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-materials.ts
 */

import { PrismaClient } from "@prisma/client";
import { DEFAULT_MATERIAL_LIST } from "../src/lib/materials";

const db = new PrismaClient();

async function main() {
  const companies = await db.company.findMany({ select: { id: true, name: true } });
  console.log(`Found ${companies.length} companies.`);

  let seeded = 0;
  let skipped = 0;

  for (const company of companies) {
    const existing = await db.material.count({ where: { companyId: company.id } });
    if (existing > 0) {
      console.log(`  SKIP  ${company.name} (already has ${existing} materials)`);
      skipped++;
      continue;
    }

    await db.material.createMany({
      data: DEFAULT_MATERIAL_LIST.map(({ name, unit }) => ({
        companyId: company.id,
        name,
        unit,
        isDefault: true,
      })),
    });

    console.log(`  SEEDED ${company.name} (${DEFAULT_MATERIAL_LIST.length} materials)`);
    seeded++;
  }

  console.log(`\nDone. Seeded: ${seeded}, Skipped: ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
