-- Reconcile the legacy NULL Site Notice targets before enforcing the singleton key.
DROP INDEX IF EXISTS "cms_drafts_one_open_existing_target_idx";
UPDATE "cms_drafts"
SET "targetId" = "tenantId" || ':site-notice'
WHERE "kind" = 'SITE_NOTICE' AND "targetId" IS NULL;
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "tenantId", "kind", "targetId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "cms_drafts"
  WHERE "status" IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'RETURNED_FOR_CHANGES')
)
UPDATE "cms_drafts" d SET "status" = 'ARCHIVED', "archivedAt" = CURRENT_TIMESTAMP
FROM ranked r WHERE d."id" = r."id" AND r.rn > 1;
CREATE UNIQUE INDEX "cms_drafts_one_open_existing_target_idx"
  ON "cms_drafts"("tenantId", "kind", "targetId")
  WHERE "targetId" IS NOT NULL
    AND "status" IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'RETURNED_FOR_CHANGES');