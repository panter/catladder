---
name: catladder-builds
description: Configuring how a component is built in a catladder project — the `build` config in catladder.ts (build types node / rails / meteor / custom, build & start commands, artifacts, caching, lint/test/audit jobs, the Docker image, and shared workspace builds). Use when adding or changing a component's build, choosing a build type, wiring a Dockerfile/nginx image, tuning the build/test/lint jobs, or setting up a monorepo workspace build. Triggers on "build config", "buildCommand", "build type", "Dockerfile", "docker image", "rails build", "monorepo build", "artifacts".
---

# Component builds with catladder

Each component in `catladder.ts` has a `build` config that catladder
turns into the setup/lint/test/build CI jobs and the deployable Docker
image. Change the build in `catladder.ts` and regenerate
(`yarn catenv`) — never hand-edit generated pipeline files (see the
`catladder-config` skill).

```ts
components: {
  www: {
    dir: "frontend",
    build: {
      type: "node",           // node | rails | meteor | custom (+ deprecated node-static/storybook)
      buildCommand: "yarn build",
      startCommand: "yarn start",
    },
    deploy: { /* see catladder-deploys */ },
  },
}
```

Set `build: false` to disable building for a component (e.g. a
deploy-only or docker-tag component).

Node-family builds work with **yarn or pnpm**: catladder autodetects the
package manager (from the `packageManager` field in package.json or the
lockfile) and generates the matching install commands, caches and
default build/lint/test commands. Override with `packageManager:
"pnpm" | "yarn"` at the top level of `catladder.ts` if needed. The
`meteor` build type is yarn-only.

pnpm gotchas: dependency build scripts must be approved
(`onlyBuiltDependencies` in pnpm-workspace.yaml); pnpm runs the root
`prepare` script even during the production install in the docker
build — guard husky with `"prepare": "husky || true"`; `pnpm run`
prints a banner to stdout, so use `pnpm --silent run` in piped
commands.

## Build types

| Type | Use for | Notes |
|---|---|---|
| `node` | Node/JS apps (Next.js, Vite, plain node) | default `<pm> build` + `<pm> start` (yarn or pnpm, autodetected); `docker` selects the runtime image |
| `rails` | Ruby on Rails apps | Cloud Native Buildpacks when there is no `Dockerfile`; Postgres test DB |
| `meteor` | Meteor apps | starts `node main.js` |
| `custom` | anything else | you provide the `jobImage` and `docker` config (both required) |
| `node-static`, `storybook` | *deprecated* | use `type: "node"` + `docker: { type: "nginx" }` |

A component can also **reuse a shared workspace build** instead of a
type: `build: { from: "web" }` (see workspace builds below).

## Common options (all standalone build types)

- `buildCommand` — the build step (`string | string[] | null | false`;
  `false`/`null` skips building).
- `startCommand` — how the app is started at runtime.
- `postInstall` — commands run after the package-manager install (node
  family; needed e.g. for Yarn PnP where `package.json` postinstall
  won't run).
- `lint` / `test` / `audit` — customize (`{ command, jobImage, … }`) or
  set to `false` to disable that job.
- `artifactsPaths` / `artifactsExcludePaths` — extra build artifacts
  (`dist` and `.next` are always included).
- `cache` — build caching (see the `catladder-pipelines` skill for the
  caching model).
- `jobImage`, `jobTags`, `jobVars`, `runnerVariables` — the CI image,
  runner tags, build-only env vars, and extra runner variables.
- `docker` — the image build strategy: a built-in
  (`{ type: "nginx" | "node" | "meteor" }`) or
  `{ type: "custom" }` (expects a `Dockerfile`).

## Workspace builds (monorepos)

For a shared build across several components, declare it once at the top
level under `builds` and reference it from each component:

```ts
builds: {
  web: { type: "node", dir: "packages/web", buildCommand: "yarn build" },
},
components: {
  www: { dir: "packages/web", build: { from: "web" }, deploy: { /* … */ } },
}
```

Only `type: "node"` workspace builds exist today.

## Full option reference

See [references/build-types.md](references/build-types.md) for every
build type's options, the `docker` sub-config, and the exact defaults.

## Related skills

- `catladder-config` — catladder.ts structure and regeneration
- `catladder-deploys` — the matching `deploy` config
- `catladder-pipelines` — how build jobs, caching and job images work
- `catladder-secrets` — env vars available at build time
