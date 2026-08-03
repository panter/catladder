---
"catladder": minor
---

New agent skill `catladder-migrate-package-manager` guides a project from yarn to pnpm (or back). It covers what catladder switches on its own once it detects the package manager — install commands, caches, docker prod install, audit and build/start defaults — and, more importantly, the repository work it does not do: the blockers to check first (meteor is yarn-only, Yarn PnP, yarn plugins), writing `pnpm-workspace.yaml` before `pnpm import` so the resolved versions survive the migration, and the fallout to fix locally rather than in a pipeline round-trip. A reference page maps every yarn command and config key to its pnpm equivalent and catalogs the behavioral traps that broke real migrations: phantom dependencies, opt-in install scripts, the root `prepare` running in `--prod` installs, the `pnpm run` banner, `sh` not expanding `**`, the missing root-script fallback, and pnpm 11 reading settings only from `pnpm-workspace.yaml`.
