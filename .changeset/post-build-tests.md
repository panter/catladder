---
"catladder": minor
---

New `postBuildTests` in the build config: named tests (e.g. a Playwright e2e suite with a Postgres service) that run against the build output in a new `post-build` stage between build and deploy, and block the deploy when they fail. Works for standalone builds, workspace builds and components built in a workspace. On GitHub, uploads now also honour `artifacts.when`, so reports of failed jobs are uploaded.
