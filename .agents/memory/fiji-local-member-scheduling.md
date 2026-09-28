---
name: Fiji-local member scheduling
description: Timezone rule for staff-created private notices and documents
---

Treat Website Admin date-time inputs for Member App visibility windows as Pacific/Fiji wall time. Convert explicitly to UTC before calling the Member App API, and convert returned UTC instants back to Fiji wall time when populating edit controls.

**Why:** Browser `datetime-local` values have no timezone. Interpreting them in the server's or browser's default timezone silently moves scheduled member visibility; a Fiji morning could become a UTC morning.

**How to apply:** Use an IANA-timezone-aware conversion for new notice/document scheduling fields, with round-trip and invalid/ambiguous-time checks. Do not hardcode an offset or parse a bare local value with `new Date(...)`.