-- Phase 12: Payroll ledger schema changes

-- Extend WalletTxnType enum with SALARY and ADVANCE_RECOVERY
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'SALARY';
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'ADVANCE_RECOVERY';

-- Add paymentDate to WalletTransaction
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "paymentDate" DATE;

-- Backfill paymentDate for existing TOPUP rows
UPDATE "WalletTransaction"
SET "paymentDate" = "createdAt"::DATE
WHERE "type" = 'TOPUP' AND "paymentDate" IS NULL;

-- CreateTable PayrollNote
CREATE TABLE IF NOT EXISTS "PayrollNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "noteDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayrollNote_companyId_userId_idx" ON "PayrollNote"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "PayrollNote" ADD CONSTRAINT "PayrollNote_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollNote" ADD CONSTRAINT "PayrollNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollNote" ADD CONSTRAINT "PayrollNote_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
