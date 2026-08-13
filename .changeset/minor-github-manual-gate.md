---
"catladder": minor
---

Manual gates on GitHub: manually gated jobs (e.g. a prod deploy) and their build closure are routed into a `workflow_dispatch` "manual tasks" workflow, where each gated job becomes a dropdown choice — GitLab's manual jobs without needing GitHub Environments (Enterprise-only approvals).
