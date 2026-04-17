-- Make companyId NOT NULL on all tables except User (SUPERADMIN has companyId=null)
ALTER TABLE "Site"              ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Vendor"            ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "WalletTransaction" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Purchase"          ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "MaterialTransfer"  ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SiteIncome"        ALTER COLUMN "companyId" SET NOT NULL;

-- Indexes for company-scoped queries
CREATE INDEX "User_companyId_idx"              ON "User"("companyId");
CREATE INDEX "Site_companyId_idx"              ON "Site"("companyId");
CREATE INDEX "Vendor_companyId_idx"            ON "Vendor"("companyId");
CREATE INDEX "WalletTransaction_companyId_idx" ON "WalletTransaction"("companyId");
CREATE INDEX "Purchase_companyId_idx"          ON "Purchase"("companyId");
CREATE INDEX "MaterialTransfer_companyId_idx"  ON "MaterialTransfer"("companyId");
CREATE INDEX "SiteIncome_companyId_idx"        ON "SiteIncome"("companyId");
CREATE INDEX "SiteAssignment_companyId_idx"    ON "SiteAssignment"("companyId");
CREATE INDEX "SiteAssignment_userId_idx"       ON "SiteAssignment"("userId");
CREATE INDEX "SiteAssignment_siteId_idx"       ON "SiteAssignment"("siteId");
