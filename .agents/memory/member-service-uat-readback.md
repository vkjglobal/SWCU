---
name: Member-service UAT read-back
description: Reliable verification of member-facing edits and individual audience selection
---

For member-facing text changes, verify the current saved value through the Member App API and current member view, not just an activity timeline. An unchanged editor field should mean no message mutation; an intentionally cleared field should send an explicit clear. For individual notices and documents, a search result must be selected before saving; a successful search is not itself a selected audience.

**Why:** During fictional DEV UAT, a historical member activity entry was mistaken for confirmation of a new edit. A separate opt-in checkbox made intended message edits easy to omit. An individual notice initially failed because searching did not select the member; the owner subsequently confirmed that explicitly selecting the result worked.

**How to apply:** When changing these flows, compare current values after save and test unchanged, changed, and cleared text separately. Show selection state and a precise missing-member error for targeted content.