---
name: Next DEV cache after production build
description: Distinguish stale generated Next DEV state from actual tenant-host or database failures
---

A production build may leave the concurrent Next.js DEV workflow serving the styled tenant 404 even for a database-mapped host. A workflow restart alone did not restore it; rebuilding the generated DEV cache and restarting did.

**Why:** In DEV UAT, the mapped SWCU host and active tenant still existed, but Home and Admin login returned 404 after the production build. After regenerating the DEV cache, the same host returned 200 with the tenant request boundary running. The underlying cause of the cache conflict was not established.

**How to apply:** Avoid running a production build concurrently with active DEV verification when practical. If a mapped host starts returning 404 immediately after a build, verify the host mapping and tenant guard, then consider regenerating only the ignored DEV build cache before altering tenant code or environment configuration.