---
"catladder": minor
---

Environments are now explicitly configurable instead of implied by their type, via the new project-wide top-level `environments` config: `on` controls when an env deploys (`"mainBranch"`, `"mr"`, `"taggedRelease"`, `{ branch: "next" }` for a stable branch-tracking environment with its own pipeline, or `false`) and `autoStop` the gitlab auto-stop duration (`false` to disable, per-component overridable via `env.<name>.autoStop`). Extra envs declared in `environments` apply to every component (opt out with `env.<name>: false`). Cloud run deploys additionally accept `revisionsToKeep` (the rollback history the post-deploy cleanup preserves). The env type keeps supplying the defaults — dev on mainBranch with 4 weeks autoStop, review per-MR with 1 week, stage/prod on tagged releases, prod keeping 5 revisions — so existing configs generate identical pipelines.
