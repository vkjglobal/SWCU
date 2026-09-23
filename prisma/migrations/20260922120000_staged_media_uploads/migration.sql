ALTER TABLE "media_assets" ADD COLUMN "stagedAt" TIMESTAMP(3);
ALTER TABLE "media_assets" ADD COLUMN "claimedAt" TIMESTAMP(3);
CREATE INDEX "media_assets_tenantId_createdBy_stagedAt_claimedAt_idx"
  ON "media_assets"("tenantId", "createdBy", "stagedAt", "claimedAt");