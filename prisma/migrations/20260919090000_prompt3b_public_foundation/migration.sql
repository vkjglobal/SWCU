ALTER TYPE "CmsDraftKind" ADD VALUE IF NOT EXISTS 'PAGE_CONTENT';
ALTER TYPE "CmsDraftKind" ADD VALUE IF NOT EXISTS 'LEADERSHIP';
ALTER TYPE "CmsDraftKind" ADD VALUE IF NOT EXISTS 'RATE_FEE';
ALTER TYPE "CmsDraftKind" ADD VALUE IF NOT EXISTS 'CALCULATOR';
ALTER TYPE "CmsDraftKind" ADD VALUE IF NOT EXISTS 'CONTACT_SETTINGS';

ALTER TABLE "form_documents"
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "isAnnualReport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "publicApprovedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "page_content" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slot" VARCHAR(60) NOT NULL,
  "heading" VARCHAR(180),
  "body" VARCHAR(8000),
  "mediaAssetId" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "page_content_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "page_content_tenantId_slot_key" ON "page_content"("tenantId","slot");
CREATE INDEX IF NOT EXISTS "page_content_tenantId_isPublished_slot_idx" ON "page_content"("tenantId","isPublished","slot");
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "leadership_records" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "profile" VARCHAR(1000),
  "group" VARCHAR(80) NOT NULL,
  "mediaAssetId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leadership_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "leadership_records_tenantId_group_isPublished_isEnabled_sortOrder_idx" ON "leadership_records"("tenantId","group","isPublished","isEnabled","sortOrder");
ALTER TABLE "leadership_records" ADD CONSTRAINT "leadership_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leadership_records" ADD CONSTRAINT "leadership_records_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "rate_fees" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "product" VARCHAR(120) NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "displayValue" VARCHAR(120) NOT NULL,
  "note" VARCHAR(500),
  "effectiveAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_fees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rate_fees_tenantId_isPublished_isEnabled_sortOrder_idx" ON "rate_fees"("tenantId","isPublished","isEnabled","sortOrder");
ALTER TABLE "rate_fees" ADD CONSTRAINT "rate_fees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "calculator_settings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" VARCHAR(60) NOT NULL DEFAULT 'AWAITING_SWCU_CONFIGURATION',
  "disclaimer" VARCHAR(300) NOT NULL DEFAULT 'Repayment figures are estimates only. Actual repayments, terms and loan approval are subject to SWCU requirements and approval.',
  "securityReminder" VARCHAR(500) NOT NULL DEFAULT 'SWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calculator_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "calculator_settings_tenantId_key" ON "calculator_settings"("tenantId");
ALTER TABLE "calculator_settings" ADD CONSTRAINT "calculator_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ContactSubmissionStatus" AS ENUM ('NEW','BEING_HANDLED','CLOSED');
CREATE TABLE IF NOT EXISTS "contact_submissions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reference" VARCHAR(30) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "phone" VARCHAR(80),
  "subject" VARCHAR(40) NOT NULL,
  "message" VARCHAR(4000) NOT NULL,
  "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW',
  "internalNote" VARCHAR(1000),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewedAt" TIMESTAMP(3),
  "handledAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_submissions_tenantId_reference_key" ON "contact_submissions"("tenantId","reference");
CREATE INDEX IF NOT EXISTS "contact_submissions_tenantId_status_submittedAt_idx" ON "contact_submissions"("tenantId","status","submittedAt");
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_rate_limits" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ipAddress" VARCHAR(80),
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_rate_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_rate_limits_key_key" ON "contact_rate_limits"("key");
CREATE INDEX IF NOT EXISTS "contact_rate_limits_tenantId_ipAddress_idx" ON "contact_rate_limits"("tenantId","ipAddress");
ALTER TABLE "contact_rate_limits" ADD CONSTRAINT "contact_rate_limits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;