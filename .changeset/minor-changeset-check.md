---
"catladder": minor
---

Changesets guardrails: merge-request pipelines get a `🦋 changeset check` job reporting what merging would release (changesets added by the MR, everything pending, the resulting version with a changelog preview) — as a warning-only job with an exposed artifact on GitLab (sticky MR comment when `GL_TOKEN` is available to MR pipelines) and a sticky PR comment on GitHub. The `⚠️ force create release` job now releases a patch bump even without pending changesets, as the recovery path for changes merged without one.
