---
"catladder": minor
---

Environments can inherit from another environment via `environments.<name>.inherit`. `inherit: "dev"` gives an env dev's per-component config overrides (merged below its own; `host` and `type` are never inherited, and the env type is implied from the inherited env) and dev's secret values — all-or-nothing: its jobs reference dev's `CL_DEV_*` variables and the env has no secret store of its own, so secrets are managed (and rotated) via the source env. The object form `inherit: { config: "dev", secrets: "dev" }` controls the two axes separately (omit `secrets` or set it to `false` for own secrets). Typical use: a stable branch-tracking env that behaves like dev — `environments: { next: { on: { branch: "next" }, inherit: "dev" } }`.
