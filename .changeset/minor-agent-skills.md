---
"catladder": minor
---

Agent skills: catladder ships agent-facing documentation as skills (`catladder-config`, `catladder-builds`, `catladder-deploys`, `catladder-secrets`, `catladder-releases`, `catladder-pipelines`, `catladder-cli` with a generated command reference). They are materialized into `.claude/skills/` on every generation (cross-agent `.agents/skills/` opt-in), so AI coding agents always see documentation matching the installed catladder version.
