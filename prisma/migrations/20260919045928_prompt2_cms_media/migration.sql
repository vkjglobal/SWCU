-- CreateTable
CREATE TABLE "site_notices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "message" VARCHAR(280) NOT NULL,
    "actionText" VARCHAR(80),
    "actionUrl" VARCHAR(500),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_hero_slides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "altText" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_highlights" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "value" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberAppLabel" TEXT NOT NULL DEFAULT 'Member App — Coming Soon',
    "memberAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "destination" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "mediaAssetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_notices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(600) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "question" VARCHAR(240) NOT NULL,
    "answer" VARCHAR(1200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organisationName" VARCHAR(160) NOT NULL,
    "streetAddress" VARCHAR(240) NOT NULL,
    "postalAddress" VARCHAR(240) NOT NULL,
    "telephone" VARCHAR(80) NOT NULL,
    "publicEmail" VARCHAR(160) NOT NULL,
    "officeHours" VARCHAR(300),
    "directionsUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" VARCHAR(200),
    "createdBy" TEXT,
    "retiredAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_notices_tenantId_isEnabled_startsAt_endsAt_idx" ON "site_notices"("tenantId", "isEnabled", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "site_notices_tenantId_key" ON "site_notices"("tenantId");

-- CreateIndex
CREATE INDEX "home_hero_slides_tenantId_isEnabled_sortOrder_idx" ON "home_hero_slides"("tenantId", "isEnabled", "sortOrder");

-- CreateIndex
CREATE INDEX "home_hero_slides_tenantId_mediaAssetId_idx" ON "home_hero_slides"("tenantId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "home_highlights_tenantId_isEnabled_sortOrder_idx" ON "home_highlights"("tenantId", "isEnabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "home_settings_tenantId_key" ON "home_settings"("tenantId");

-- CreateIndex
CREATE INDEX "services_tenantId_isEnabled_sortOrder_idx" ON "services"("tenantId", "isEnabled", "sortOrder");

-- CreateIndex
CREATE INDEX "form_documents_tenantId_isEnabled_sortOrder_idx" ON "form_documents"("tenantId", "isEnabled", "sortOrder");

-- CreateIndex
CREATE INDEX "news_notices_tenantId_isPublished_publishedAt_idx" ON "news_notices"("tenantId", "isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "faqs_tenantId_isEnabled_sortOrder_idx" ON "faqs"("tenantId", "isEnabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "contact_settings_tenantId_key" ON "contact_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_objectKey_key" ON "media_assets"("objectKey");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_purpose_retiredAt_idx" ON "media_assets"("tenantId", "purpose", "retiredAt");

-- CreateIndex
CREATE INDEX "media_assets_tenantId_createdAt_idx" ON "media_assets"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_createdBy_idx" ON "media_assets"("createdBy");

-- AddForeignKey
ALTER TABLE "site_notices" ADD CONSTRAINT "site_notices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_hero_slides" ADD CONSTRAINT "home_hero_slides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_hero_slides" ADD CONSTRAINT "home_hero_slides_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_highlights" ADD CONSTRAINT "home_highlights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_settings" ADD CONSTRAINT "home_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_documents" ADD CONSTRAINT "form_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_documents" ADD CONSTRAINT "form_documents_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_notices" ADD CONSTRAINT "news_notices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
