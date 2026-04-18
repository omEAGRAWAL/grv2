-- CreateTable
CREATE TABLE "SiteUpdate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workDone" TEXT NOT NULL,
    "headcount" INTEGER,
    "blockers" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "submittedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "consumedDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "loggedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteUpdate_companyId_siteId_createdAt_idx" ON "SiteUpdate"("companyId", "siteId", "createdAt");
CREATE INDEX "SiteUpdate_siteId_createdAt_idx" ON "SiteUpdate"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialConsumption_companyId_siteId_createdAt_idx" ON "MaterialConsumption"("companyId", "siteId", "createdAt");
CREATE INDEX "MaterialConsumption_siteId_idx" ON "MaterialConsumption"("siteId");

-- AddForeignKey
ALTER TABLE "SiteUpdate" ADD CONSTRAINT "SiteUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteUpdate" ADD CONSTRAINT "SiteUpdate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteUpdate" ADD CONSTRAINT "SiteUpdate_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteUpdate" ADD CONSTRAINT "SiteUpdate_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
