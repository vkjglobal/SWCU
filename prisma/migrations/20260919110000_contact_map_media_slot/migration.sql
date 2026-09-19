ALTER TABLE "contact_settings" ADD COLUMN "contactMapMediaAssetId" TEXT;

CREATE UNIQUE INDEX "contact_settings_contactMapMediaAssetId_key" ON "contact_settings"("contactMapMediaAssetId");

ALTER TABLE "contact_settings"
ADD CONSTRAINT "contact_settings_contactMapMediaAssetId_fkey"
FOREIGN KEY ("contactMapMediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;