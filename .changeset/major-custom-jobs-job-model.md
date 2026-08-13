---
"catladder": major
---

`customJobs` job model: `needsStages` is removed in favour of semantic requirements — declare `requires: [{ capability: "deployment" }]` instead of `needsStages: [{ stage: "deploy" }]` (capabilities: `build`, `qualityGate`, `deployment`, with `artifacts`, `from` and `strict`). Job `environment` keys are now platform-neutral: `on_stop` → `onStop`, `auto_stop_in` → `autoStopIn`, and `action` is narrowed to `start` | `stop` | `access`. Requirements that consume artifacts (`artifacts: true`) now fail pipeline generation when no job provides them, instead of silently deploying without them.
