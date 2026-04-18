-- Add ownerMobile to Company (unique, nullable)
ALTER TABLE "Company" ADD COLUMN "ownerMobile" TEXT;
CREATE UNIQUE INDEX "Company_ownerMobile_key" ON "Company"("ownerMobile");

-- Add mobileNumber to User (nullable)
ALTER TABLE "User" ADD COLUMN "mobileNumber" TEXT;
