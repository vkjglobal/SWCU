INSERT INTO "page_content" (
  "id",
  "tenantId",
  "slot",
  "heading",
  "body",
  "isPublished",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'important-information-' || md5("tenants"."id"),
  "tenants"."id",
  'IMPORTANT_INFORMATION',
  'Important Information',
  E'Repayment figures are estimates only. Actual repayments, terms and loan approval are subject to SWCU requirements and approval.\n\nSWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants"
WHERE lower("tenants"."slug") = 'swcu'
ON CONFLICT ("tenantId", "slot") DO UPDATE SET
  "heading" = EXCLUDED."heading",
  "body" = EXCLUDED."body",
  "isPublished" = true,
  "publishedAt" = COALESCE("page_content"."publishedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP;