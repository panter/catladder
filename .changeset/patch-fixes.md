---
"catladder": patch
---

Numerous fixes across both backends: fully-literal dotenv values are no longer bash-escaped, in-workspace component jobs use the workspace's cache slots, hidden files are included in GitHub artifacts, npm publish authentication works in workspace monorepos, stale materialized image definitions are cleaned per generation, and the semantic-release tooling was upgraded to v25 with an exactly-pinned self-contained image.
