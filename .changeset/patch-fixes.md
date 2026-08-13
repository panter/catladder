---
"catladder": patch
---

Fixes across both backends: fully-literal dotenv values are no longer bash-escaped, in-workspace component jobs use the workspace's cache slots, hidden files are included in GitHub artifacts, npm publish authentication works in workspace monorepos, cross-component secret references are injected into GitHub job env, stale materialized image definitions are cleaned on every generation, an invalid store file is treated as missing instead of crashing, and Cloud Run database-delete retries are capped instead of looping forever.
