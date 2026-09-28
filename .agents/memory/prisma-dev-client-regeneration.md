---
name: Prisma client regeneration in DEV
description: Running Next DEV may retain a Prisma client generated before a schema change
---

After adding a Prisma model field, regenerate the client, apply the development migration, and restart the running Next DEV workflow before treating an `Unknown field ... for select` error as a schema or migration failure.

**Why:** A production build and generated client succeeded while the concurrent DEV process still held an older Prisma client and returned a public-page error. One workflow restart picked up the regenerated client and restored the page without code or data changes.

**How to apply:** On future Prisma schema edits, use the project's normal development migration and generation commands, restart the existing workflow once, then smoke-check affected routes. Do not change tenant logic or repeat migration solely because an already-running process reports an unknown field.