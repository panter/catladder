---
"@catladder/cli": patch
---

github: build artifacts now honor `artifactsExcludePaths` and the default excludes, like gitlab does. Node builds no longer upload `.next/cache` (often two thirds of the archive) or a build-time `.env` between jobs.
