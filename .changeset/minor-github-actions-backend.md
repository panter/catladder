---
"catladder": minor
---

GitHub Actions backend: `pipelines: { gitlab: true, github: true }` generates workflows for both CI systems in parallel from the same config. Includes environment-scoped secrets, content-keyed node caches, manual gates routed through `workflow_dispatch`, committed job scripts, and release jobs — with per-pipeline-type `runnerVariables` for backend-specific tuning.
