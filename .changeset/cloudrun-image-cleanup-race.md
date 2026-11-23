---
"@catladder/cli": patch
---

Keep more recent Cloud Run images during post-deploy cleanup to protect images pushed by concurrent pipelines. Add the optional `imagesToKeep` deploy setting to configure image retention.
