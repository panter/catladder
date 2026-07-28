---
"catladder": minor
---

Per-pipeline-type `runnerVariables`: `pipelines: { gitlab: { runnerVariables: {…} } }` sets CI variables for one backend only, for tuning that differs between GitLab runners and GitHub runners (memory requests, concurrency limits) without leaking into the other.
