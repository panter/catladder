---
"catladder": minor
---

`project setup` now configures github merge gating, and `project doctor` verifies it. A fresh github repository lets PRs merge while checks are still running and never shows the auto-merge button — gitlab ships this behavior built-in. Setup enables auto-merge (+ delete-merged-branches) and adds a branch protection rule on the default branch requiring the generated `catladder ✅` check, merging non-destructively into any existing protection. Admins can still bypass per PR. On github-only projects, setup now also skips the gitlab-specific provisioning (access token, agent webhooks) instead of failing.
