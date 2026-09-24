---
name: Headless Chromium responsive checks
description: Environment-specific CDP caveats for checking narrow page layouts without a full browser-test pass.
---

Create a fresh page target for headless Chromium responsive checks rather than connecting to the first target in the target list. After navigation, poll for the expected route and rendered content before evaluating geometry.

**Why:** In this workspace the first CDP target was a browser background page, not the requested website. Even with a new page target, evaluating immediately after navigation sometimes returned no value because its execution context was not ready.

**How to apply:** For a lightweight width/overflow check, explicitly create a new page target, set device metrics for each viewport, navigate, then wait until the route and expected content appear before comparing document scroll width with client width. Use the proxied development domain for tenant-resolved pages. This is not a replacement for interactive journey testing.