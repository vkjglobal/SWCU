---
name: Headless Chromium responsive checks
description: Environment-specific CDP caveats for checking narrow page layouts without a full browser-test pass.
---

Create a fresh page target for headless Chromium responsive checks rather than connecting to the first target in the target list. After navigation, wait for the page and CSS to settle before evaluating geometry. Before a pointer click on a link brought into view with `scrollIntoView`, wait for smooth scrolling to finish and confirm `elementFromPoint` resolves to that link.

**Why:** In this workspace the first CDP target was a browser background page, not the requested website. Even with a new page target, evaluating immediately after navigation sometimes returned no value because its execution context was not ready; measuring before CSS settled produced a false overflow. An immediate pointer click after scrolling missed the link because smooth scrolling had not finished.

**How to apply:** For a lightweight width/overflow check, explicitly create a new page target, set device metrics for each viewport, navigate, then wait for document completion and applied styles before comparing document scroll width with client width. For link clicks, verify the settled coordinates with `elementFromPoint` first. Use the proxied development domain for tenant-resolved pages. This is not a replacement for interactive journey testing.