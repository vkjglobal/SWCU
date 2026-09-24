---
name: Tenant-host DEV UAT
description: Host-header constraints when checking tenant isolation through the Replit development proxy.
---

The development proxy owns the forwarded-host headers of requests to the proxied URL. A client-supplied cross-tenant hostname sent through that URL may not reach the app, so a successful response does not by itself prove a tenant isolation bug.

**Why:** A media isolation check received a same-tenant PDF while attempting to spoof a second tenant through the proxy. The proxy preserved the normal DEV host, causing the app to resolve the default tenant instead. Direct handler import was not a reliable substitute under the server-only React runtime.

**How to apply:** Verify which host the application actually receives before interpreting a negative tenant test. Use the proxied URL for normal DEV checks; for a cross-tenant Host probe, use an explicitly mapped test domain that reaches the app or a narrowly scoped request to the local DEV server with the mapped Host header. Keep production host resolution fail-closed.