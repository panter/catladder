---
"catladder": minor
---

Add an optional `timeout` (e.g. `"10m"`, `"1h 30m"`) to lint/test/audit jobs, `postBuildTests` and `verify`. GitLab emits `timeout`, GitHub emits `timeout-minutes` (rounded up to whole minutes).
