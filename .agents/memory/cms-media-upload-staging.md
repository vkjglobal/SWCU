---
name: Two-stage CMS media uploads
description: Safety rules for separating binary transport from metadata Server Actions.
---

Treat a binary upload as disposable staging until its metadata action succeeds. Claims must be tenant- and actor-bound, one-time, and validated against a server-persisted upload class.

**Why:** Moving binaries out of Server Actions creates a gap between R2/MediaAsset creation and CMS attachment. Without explicit claim and finalization states, retries or forged IDs can reuse uploads, leak staged objects, or delete finalized media during compensation.

**How to apply:** Finalize every successful metadata or draft path. Cleanup must hold the tenant lock while rechecking every live and open-draft reference, deleting R2, and retiring the row. Never clean up a target/self or finalized asset.