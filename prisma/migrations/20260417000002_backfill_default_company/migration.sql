-- Insert a default company to hold all pre-multitenancy data
INSERT INTO "Company" ("id", "name", "status", "createdAt", "updatedAt")
SELECT 'legacy-company', 'Default Company', 'ACTIVE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Company" WHERE "id" = 'legacy-company');

-- Backfill companyId for all users (SUPERADMIN will have it updated to null after seeding)
UPDATE "User" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;

-- Backfill financial tables
UPDATE "Site"              SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
UPDATE "Vendor"            SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
UPDATE "WalletTransaction" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
UPDATE "Purchase"          SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
UPDATE "MaterialTransfer"  SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
UPDATE "SiteIncome"        SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
