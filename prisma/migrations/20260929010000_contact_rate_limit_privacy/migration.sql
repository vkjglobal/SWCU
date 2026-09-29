-- Retire legacy raw-IP rate-limit identifiers without deleting enquiries or audits.
-- These operational counters are reset; new entries use hashed keys and no IP field.
UPDATE "contact_rate_limits"
SET "key" = "tenantId" || ':legacy:' || "id",
    "ipAddress" = NULL
WHERE "ipAddress" IS NOT NULL;