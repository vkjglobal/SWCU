---
name: Reset-link setup reliability
description: Client-side reliability rules for one-time password setup forms.
---

Capture a one-time URL-fragment token in a component ref before removing the fragment, and retain it across the development Strict Mode effect setup/cleanup replay.

**Why:** Removing the fragment during the first effect run can leave the replay with no token. If cleanup also cancels an asynchronous state update, the reset form remains disabled even though the original link was valid.

**How to apply:** For client-only reset/setup links, retain the fragment synchronously in a ref, then update rendered state asynchronously and call `history.replaceState` to remove the sensitive fragment.

Do not rely solely on native `required` or `minLength` validation for password setup forms. Use explicit inline validation and visible errors before submission.

**Why:** Native constraint validation can stop submission before a React or server action runs, leaving no request in the logs and no persistent explanation for the user.

**How to apply:** Disable native form validation for this flow, validate the password policy and confirmation in the client submit handler, and repeat the checks server-side.