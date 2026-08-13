---
"catladder": patch
---

The queued-release executor (`🚀 release once pipeline succeeds`) now only `needs:` the sink jobs of the main-branch pipeline — the deploy/verify tips and terminal quality jobs — instead of every automatic job. `needs:` is transitive, so the coverage is identical (a failed ancestor still skips its descendants and with them the executor), but the needs list stays far below GitLab's 50-entry cap: large multi-component pipelines that previously fell back to the legacy after-the-pipeline release button get the click-any-time queueing back.
