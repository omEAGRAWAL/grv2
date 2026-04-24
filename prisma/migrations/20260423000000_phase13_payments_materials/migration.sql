-- Phase 13: purchase payment tracking + company material master

-- New enums
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- Add paymentStatus to existing Purchase rows (default UNPAID; migration script sets existing rows to PAID)
ALTER TABLE "Purchase" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- PurchasePayment table
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amountPaidPaise" BIGINT NOT NULL,
    "paidDate" DATE NOT NULL,
    "paidByUserId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentProofUrl" TEXT,
    "paymentProofPublicId" TEXT,
    "notes" TEXT,
    "loggedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "relatedWalletTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- Material master table
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- Indexes for PurchasePayment
CREATE INDEX "PurchasePayment_companyId_idx" ON "PurchasePayment"("companyId");
CREATE INDEX "PurchasePayment_purchaseId_idx" ON "PurchasePayment"("purchaseId");

-- Indexes for Material
CREATE UNIQUE INDEX "Material_companyId_name_key" ON "Material"("companyId", "name");
CREATE INDEX "Material_companyId_idx" ON "Material"("companyId");

-- Foreign keys for PurchasePayment
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_paidByUserId_fkey"
    FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_loggedById_fkey"
    FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key for Material
ALTER TABLE "Material" ADD CONSTRAINT "Material_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
