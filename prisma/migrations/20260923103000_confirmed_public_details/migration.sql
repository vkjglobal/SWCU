DO $$
DECLARE
  swcu_id TEXT;
BEGIN
  SELECT "id" INTO swcu_id FROM "tenants" WHERE "slug" = 'swcu';
  IF swcu_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "contact_settings"
  SET "streetAddress" = '300 Waimanu Road, Suva',
      "postalAddress" = 'GPO Box 1405, Suva',
      "telephone" = '(679) 7777345',
      "secondaryTelephone" = '(679) 8936901',
      "officeHours" = E'Monday–Thursday: 8.30 am to 4.30 pm\nFriday: 8.30 am to 4.00 pm',
      "notificationRecipients" = '["swcu@gmail.com","devika_s@fpsa.org.fj"]'::jsonb,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "tenantId" = swcu_id;

  UPDATE "page_content"
  SET "heading" = 'Our Story',
      "body" = 'Service Worker Credit Union was established on 14 September 2000. Today, SWCU serves its members from 300 Waimanu Road, Suva.',
      "isPublished" = true,
      "publishedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP),
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "tenantId" = swcu_id
    AND "slot" = 'ABOUT_STORY';

  UPDATE "form_documents"
  SET "publicApprovedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "tenantId" = swcu_id
    AND "isAnnualReport" = true
    AND "publicApprovedAt" IS NOT NULL;
END $$;