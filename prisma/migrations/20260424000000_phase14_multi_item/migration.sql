-- Phase 14: Multi-item purchases and LOCAL purchase type
-- ⚠️  RISKY: restructures the Purchase table. Test on a DB clone first.
--
-- Stage 1: Create PurchaseType enum
-- Stage 2: Create PurchaseLineItem table
-- Stage 3: Add new columns to Purchase (purchaseType, sellerName)
-- Stage 4: Make legacy columns nullable (keep for rollback window)
-- NOTE: Data migration (populating PurchaseLineItem from existing rows) is in
--       scripts/migrate-purchase-lineitems.ts — run AFTER this migration.

-- Stage 1: PurchaseType enum
CREATE TYPE "PurchaseType" AS ENUM ('VENDOR', 'LOCAL');

-- Stage 2: PurchaseLineItem table
CREATE TABLE "PurchaseLineItem" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "purchaseId"      TEXT NOT NULL,
    "itemName"        TEXT NOT NULL,
    "quantity"        DECIMAL(14,4) NOT NULL,
    "unit"            TEXT NOT NULL,
    "ratePaise"       BIGINT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gstPercent"      DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotalPaise"  BIGINT NOT NULL,
    "displayOrder"    INTEGER NOT NULL DEFAULT 0,
    "materialId"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseLineItem_pkey" PRIMARY KEY ("id")
);

-- Stage 3: New columns on Purchase
ALTER TABLE "Purchase" ADD COLUMN "purchaseType" "PurchaseType" NOT NULL DEFAULT 'VENDOR';
ALTER TABLE "Purchase" ADD COLUMN "sellerName" TEXT;

-- Stage 4: Make legacy single-item columns nullable (rollback window — drop in Phase 15)
ALTER TABLE "Purchase" ALTER COLUMN "vendorId"        DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "itemName"        DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "quantity"        DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "unit"            DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "ratePaise"       DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "discountPercent" DROP NOT NULL;
ALTER TABLE "Purchase" ALTER COLUMN "gstPercent"      DROP NOT NULL;

-- Foreign key: PurchaseLineItem → Purchase
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key: PurchaseLineItem → Company
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key: PurchaseLineItem → Material (nullable)
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PurchaseLineItem_purchaseId_idx" ON "PurchaseLineItem"("purchaseId");
CREATE INDEX "PurchaseLineItem_companyId_idx"  ON "PurchaseLineItem"("companyId");
