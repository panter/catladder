---
"catladder": minor
---

pnpm support for node builds: the package manager is autodetected (the `packageManager` field in package.json, then the lockfile, falling back to yarn) and can be pinned with the new top-level `packageManager: "pnpm" | "yarn"`. Install commands, the default build/lint/test/audit commands, the docker production install (`pnpm install --prod --frozen-lockfile --filter <component>...`, the equivalent of `yarn workspaces focus`) and the CI caches all follow the detected manager. pnpm projects cache a project-local `.pnpm-store` (keyed per pnpm major, since store formats change on majors) alongside a lockfile-keyed `node_modules` cache; workspace manifests, `pnpm-workspace.yaml` and patch files travel into the docker build context as a single layer, and job images ship pnpm. Yarn projects generate byte-identical pipelines. The `meteor` build type remains yarn-only.
