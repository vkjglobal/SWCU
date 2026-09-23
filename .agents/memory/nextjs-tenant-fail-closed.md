---
name: Next.js tenant fail-closed boundary
description: Why production tenant rejection must happen before App Router rendering in this project.
---

Reject an unrecognised production hostname at the request proxy before route rendering begins. When the app uses `src/app`, keep the Next.js 16 proxy alongside it under `src/`. Server routes must resolve tenancy from the same validated `Host` header and must not prefer a client-supplied forwarded-host header.

**Why:** A tenant check that called `notFound()` from a layout returned HTTP 404 but the response still serialized child React Server Component content. A root-level proxy file was not registered for this `src/app` project, so it did not prevent that exposure. Separately, preferring an untrusted forwarded-host value in an API route can select a different tenant than the proxy validated.

**How to apply:** Keep the database-backed tenant resolver authoritative, invoke it from the early request boundary, and return a minimal no-store 404 before public or CMS routes render. Resolve server-route tenancy from `Host` consistently with that boundary; only trust a forwarded-host value if infrastructure strips client values and supplies an authenticated replacement. Keep server-side tenant and membership checks behind the proxy as defence in depth.