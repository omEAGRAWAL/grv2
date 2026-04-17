-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- Extend Role enum with new values
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';
ALTER TYPE "Role" ADD VALUE 'SITE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';
ALTER TYPE "Role" ADD VALUE 'WORKER';

-- CreateTable: Company
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- Add nullable companyId + new fields to User
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "mobileVerified" BOOLEAN NOT NULL DEFAULT false;

-- Drop old username unique constraint, replace with composite
DROP INDEX "User_username_key";
CREATE UNIQUE INDEX "User_companyId_username_key" ON "User"("companyId", "username");

-- Add nullable companyId to all financial tables
ALTER TABLE "Site" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "companyId" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "companyId" TEXT;
ALTER TABLE "MaterialTransfer" ADD COLUMN "companyId" TEXT;
ALTER TABLE "SiteIncome" ADD COLUMN "companyId" TEXT;

-- CreateTable: SiteAssignment
CREATE TABLE "SiteAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteAssignment_userId_siteId_key" ON "SiteAssignment"("userId", "siteId");

-- AddForeignKey constraints
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Site" ADD CONSTRAINT "Site_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteIncome" ADD CONSTRAINT "SiteIncome_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
