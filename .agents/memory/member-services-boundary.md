---
name: Member services boundary
description: Owner-locked separation between the website Admin portal and the future private Member App service
---

The existing website Admin remains the one visible staff portal and login. The future Member App is a separate project, repository, and database; it owns private member requests, notices, documents, member authentication, and private file storage. Website Admin communicates with it only through an authenticated server-to-server client. Business Central remains separate for a later phase.

**Why:** The owner explicitly locked this architecture to keep private member records out of the public website's data and media systems without forcing staff to use a second Admin portal.

**How to apply:** Treat an unconfigured Member App connection as a normal disabled Admin state, never as a reason to invent website tables or upload private files into the website media/R2 pipeline. The Admin browser must not call the Member App private API directly. A future Member App service must verify the service credential and tenant binding and audit authenticated staff reads and changes using server-supplied actor identity; never trust a browser-provided actor header.