-- Deterministic legacy repair: keep the oldest open Site Notice draft per tenant,
-- map it to the tenant singleton key, and archive later duplicates without changing
-- the published SiteNotice row. Actor is NULL because these rows predate the repair.
UPDATE "cms_drafts"
SET "targetId" = "tenantId" || ':site-notice'
WHERE "kind" = 'SITE_NOTICE' AND "targetId" IS NULL;

WITH ranked AS (
  SELECT "id", "tenantId", row_number() OVER (PARTITION BY "tenantId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "cms_drafts"
  WHERE "kind" = 'SITE_NOTICE'
    AND "status" IN ('DRAFT', 'WAITING_FOR_APPROVAL', 'RETURNED_FOR_CHANGES')
)
UPDATE "cms_drafts" d
SET "status" = 'ARCHIVED', "archivedAt" = CURRENT_TIMESTAMP
FROM ranked r
WHERE d."id" = r."id" AND r.rn > 1;

INSERT INTO "audit_logs" ("id", "tenantId", "actorUserId", "action", "targetType", "targetId", "changeMetadata")
SELECT md5(random()::text || clock_timestamp()::text || d."id"), d."tenantId", NULL, 'CMS_DRAFT_LEGACY_DUPLICATE_ARCHIVED', 'CmsDraft', d."id",
       jsonb_build_object('reason', 'deterministic legacy Site Notice backfill', 'keptOldestOpenDraft', true)
FROM "cms_drafts" d
WHERE d."kind" = 'SITE_NOTICE' AND d."status" = 'ARCHIVED'
  AND d."archivedAt" >= CURRENT_TIMESTAMP - INTERVAL '1 minute';