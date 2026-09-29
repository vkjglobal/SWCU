---
name: Development environment settings and tracked configuration
description: Avoid accidentally committing temporary test configuration written into tracked workspace files
---

Development environment-variable changes can be written into the tracked `.replit` file rather than an untracked local environment file. Inspect its diff after using environment-setting tools, especially for temporary test configuration.

**Why:** A development-only integration test setting appeared in tracked configuration during Contact form verification. Removing it through the environment-management tool restored a clean configuration diff before the feature commit.

**How to apply:** When using temporary development values, review Git status before staging, remove the values after verification, and keep actual credentials in the workspace secrets flow rather than committing them.