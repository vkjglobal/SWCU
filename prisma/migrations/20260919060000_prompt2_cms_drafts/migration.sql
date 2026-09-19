-- CreateEnum
CREATE TYPE "CmsDraftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CmsDraftKind" AS ENUM ('SITE_NOTICE', 'NEWS', 'FAQ', 'FORM_DOCUMENT', 'HERO', 'MEDIA');

-- CreateEnum
CREATE TYPE "CmsDraftOperation" AS ENUM ('CREATE', 'UPDATE', 'REMOVE', 'REPLACE', 'REORDER', 'TOGGLE', 'UPLOAD', 'RETIRE');

-- CreateTable
CREATE TABLE "cms_drafts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "CmsDraftKind" NOT NULL,
    "operation" "CmsDraftOperation" NOT NULL,
    "status" "CmsDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "targetId" TEXT,
    "payload" JSONB NOT NULL,
    "mediaAssetId" TEXT,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "cms_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_drafts_tenantId_status_createdAt_idx" ON "cms_drafts"("tenantId", "status", "createdAt");
CREATE INDEX "cms_drafts_tenantId_kind_targetId_status_idx" ON "cms_drafts"("tenantId", "kind", "targetId", "status");
CREATE INDEX "cms_drafts_createdBy_status_idx" ON "cms_drafts"("createdBy", "status");
CREATE INDEX "cms_drafts_mediaAssetId_idx" ON "cms_drafts"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "cms_drafts" ADD CONSTRAINT "cms_drafts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cms_drafts" ADD CONSTRAINT "cms_drafts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cms_drafts" ADD CONSTRAINT "cms_drafts_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cms_drafts" ADD CONSTRAINT "cms_drafts_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;