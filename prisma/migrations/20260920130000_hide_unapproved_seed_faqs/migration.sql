UPDATE "faqs"
SET "isEnabled" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tenantId" IN (
  SELECT "id"
  FROM "tenants"
  WHERE "slug" = 'swcu'
)
AND "question" IN (
  'Where can I find SWCU forms?',
  'How can I learn about joining SWCU?',
  'How do I contact SWCU?'
);