---
"catladder": minor
---

The generated yarn audit job actually audits the project. `yarn npm audit` checks only the **current** workspace's **direct** dependencies, so in a monorepo it checked the root manifest — which usually has no production dependencies — and the 🛡 audit job passed without looking at a single app. It now runs with `--all --recursive` (every workspace, transitive dependencies), which is what `pnpm audit --prod` and classic `yarn audit` do on their own; classic additionally gets `--groups dependencies` so `--environment production` and its behaviour match. Expect a previously green audit job on a yarn monorepo to start reporting long-standing vulnerabilities — they were always there, nothing was checking.

The severity threshold is configurable now: `audit: { level: "high" }` on a build config (`info` | `low` | `moderate` | `high` | `critical`, default `critical`), translated to each package manager's own flag — `pnpm audit --audit-level`, `yarn npm audit --severity`, classic `yarn audit --level`. A custom `audit: { command }` still wins over both.
