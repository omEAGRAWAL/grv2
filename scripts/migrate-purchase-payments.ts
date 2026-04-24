/**
 * Data migration for Phase 13: create PurchasePayment rows for all existing
 * v1 purchases and set their paymentStatus.
 *
 * Rules (per spec):
 *   - Purchases with paidByUserId set → find linked VENDOR_PAYMENT WalletTransaction,
 *     create a PurchasePayment row linking to it, mark status = PAID.
 *   - Purchases with paidByUserId = null (owner-direct) → create a PurchasePayment
 *     with paidByUserId = null, method = CASH, paidDate = purchaseDate, mark PAID.
 *   - Purchases that already have PurchasePayment rows → skip.
 *
 * IMPORTANT: Run on a DB clone first. Back up production before deploying.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-purchase-payments.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const purchases = await db.purchase.findMany({
    where: { voidedAt: null },
    select: {
      id: true,
      companyId: true,
      paidByUserId: true,
      totalPaise: true,
      purchaseDate: true,
      loggedById: true,
    },
  });

  console.log(`Found ${purchases.length} non-voided purchases to inspect.`);

  let migrated = 0;
  let skipped = 0;

  for (const p of purchases) {
    // Check if already has payment rows
    const existingPayment = await db.purchasePayment.findFirst({
      where: { purchaseId: p.id },
    });
    if (existingPayment) {
      skipped++;
      continue;
    }

    let relatedWalletTxnId: string | null = null;

    if (p.paidByUserId) {
      // Find the linked VENDOR_PAYMENT wallet transaction
      const walletTxn = await db.walletTransaction.findFirst({
        where: {
          relatedPurchaseId: p.id,
          type: "VENDOR_PAYMENT",
          actorUserId: p.paidByUserId,
        },
        select: { id: true },
      });
      relatedWalletTxnId = walletTxn?.id ?? null;
    }

    await db.$transaction(async (tx) => {
      await tx.purchasePayment.create({
        data: {
          companyId: p.companyId,
          purchaseId: p.id,
          amountPaidPaise: p.totalPaise,
          paidDate: p.purchaseDate,
          paidByUserId: p.paidByUserId,
          paymentMethod: "CASH",
          loggedById: p.loggedById,
          relatedWalletTxnId,
        },
      });
      await tx.purchase.update({
        where: { id: p.id },
        data: { paymentStatus: "PAID" },
      });
    });

    migrated++;
    if (migrated % 100 === 0) {
      console.log(`  Migrated ${migrated}...`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped (already had rows): ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
