---
name: Reset-link fragment hydration
description: React Strict Mode behavior when consuming one-time tokens from URL fragments.
---

Capture a one-time URL-fragment token in a component ref before removing the fragment, and retain it across the development Strict Mode effect setup/cleanup replay.

**Why:** Removing the fragment during the first effect run can leave the replay with no token. If cleanup also cancels an asynchronous state update, the reset form remains disabled even though the original link was valid.

**How to apply:** For client-only reset/setup links, retain the fragment synchronously in a ref, then update rendered state asynchronously and call `history.replaceState` to remove the sensitive fragment.