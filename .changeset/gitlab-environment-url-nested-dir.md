---
"catladder": patch
---

GitLab: deploys of components with a nested `dir` (e.g. `pages`, `custom`) now get their environment url — the dotenv report is written under `$CI_PROJECT_DIR` instead of the component dir, where GitLab never found it. The pages docs now note that per-MR previews (parallel deployments) need GitLab Premium/Ultimate; on CE/Free disable the review env, or a review deploy overwrites the main site.
