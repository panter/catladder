---
name: catladder-builds
description: Configuring how a component is built in a catladder project — the `build` config in catladder.ts (build types node / rails / meteor / custom, build & start commands, artifacts, caching, lint/test/audit jobs, the Docker image, project-declared job images, and shared workspace builds). Use when adding or changing a component's build, choosing a build type, wiring a Dockerfile/nginx image, declaring a custom CI job image (`images` config), tuning the build/test/lint jobs, adding e2e tests against the build (`postBuildTests`), or setting up a monorepo workspace build. Triggers on "build config", "postBuildTests", "post-build test", "e2e", "playwright", "buildCommand", "build type", "Dockerfile", "docker image", "job image", "jobImage", "custom image", "project image", "rails build", "monorepo build", "artifacts".
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

pnpm gotchas: dependency build scripts must be approved in
pnpm-workspace.yaml (`allowBuilds` map since pnpm 11,
`onlyBuiltDependencies` list on pnpm 10); pnpm runs the root
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
- `postBuildTests` — named tests against the **build output** (e.g. an
  e2e suite against the production build with a Postgres service). Each
  entry becomes a job in the `post-build` stage between build and deploy
  and blocks the deploy when it fails (see below).
- `artifactsPaths` / `artifactsExcludePaths` — extra build artifacts
  (`dist` and `.next` are always included).
- `cache` — build caching (see the `catladder-pipelines` skill for the
  caching model).
- `jobImage`, `jobTags`, `jobVars`, `runnerVariables` — the CI image,
  runner tags, build-only env vars, and extra runner variables. A
  `jobImage` is a concrete image url or `{ image: "<name>" }`
  referencing a project image (see below).
- `reuseMainBranchImage` — in release pipelines, stage/prod copy the
  image the main branch (`dev`) built for the released commit instead of
  rebuilding it (falls back to a build). Only for images that don't
  depend on the env, e.g. Rails via Cloud Native Buildpacks.
- `docker` — the image build strategy: a built-in
  (`{ type: "nginx" | "node" | "meteor" }`) or
  `{ type: "custom" }` (expects a `Dockerfile`).

## Post-build tests (e2e against the build)

`lint`/`test` run against the sources, in parallel with the build. Tests
that need the built app go into `postBuildTests`:

```ts
build: {
  type: "node",
  postBuildTests: {
    e2e: {
      command: "pnpm test:e2e",                  // runs in the build dir
      jobImage: "mcr.microsoft.com/playwright:v1.56.0-noble",
      services: [{ name: "postgres:17", alias: "postgres",
                   variables: { POSTGRES_PASSWORD: "postgres" } }],
      vars: { DATABASE_URL: "postgres://postgres:postgres@postgres:5432/postgres" },
      artifacts: { paths: ["apps/web/playwright-report"] }, // repo-root relative
    },
  },
}
```

- The job (`🔬 e2e`, stage `post-build <env>`) downloads the build
  artifacts (`.next`, `dist`, `artifactsPaths`), installs dependencies
  for node builds, then runs `command`. The command starts the app
  itself, e.g. playwright `webServer: { command: "pnpm start" }`.
  Builds without artifacts (`rails`, `buildCommand: false`) just run
  it after the build.
- It is a quality gate: the env's deploy waits for it; on github it is
  part of the `catladder ✅` required check. `allowFailure: true` makes
  it report-only.
- It gets the build vars plus `vars`, **not** the deployed env's
  runtime vars/secrets — use services instead of the real database.
- Artifacts are uploaded also when the job fails.
- Not run in tagged releases. Disable one per env:
  `env: { dev: { build: { postBuildTests: { e2e: false } } } }`.
- Names must not clash with other jobs of the component (e.g. `test`,
  `lint`) — generation fails with a clear error.
- Workspace builds: on `builds.<ws>` they block the deploys of all
  components in the workspace; on `build: { from: "<ws>", postBuildTests }`
  only that component's deploy.
- To test the **deployed** env instead (smoke tests on dev / review
  apps), use the component's `verify` (post-deploy, does not block the
  deploy). The same suite can serve both, with `BASE_URL` as the switch.

## Project images (custom CI job images)

When a job needs a toolchain catladder doesn't ship (Java, Playwright,
…), declare a Docker image at the top level under `images` and reference
it in any `jobImage` field (build, `test.jobImage`, `postBuildTests`, custom/pages deploy,
verify):

```ts
images: {
  // (a) a directory in the repo (default context = the dir)
  "java-build": {
    dir: "docker/java-build",                 // contains the Dockerfile
    buildArgs: { MAVEN_VERSION: "3.9.9" },    // optional, part of the content hash
    hashExtraPaths: ["shared/settings.xml"],  // optional extra hashed+watched files
  },
  // (b) inline (default context = repo root); materialized into
  // .catladder-generated/images/project/<name>/Dockerfile
  "db-tools": {
    dockerfile: ["FROM alpine:3.21", "RUN apk add --no-cache postgresql17-client"],
  },
},
components: {
  api: {
    build: { type: "custom", jobImage: { image: "java-build" }, docker: { type: "custom" } },
  },
}
```

`dir` and `dockerfile` are mutually exclusive. `context` overrides the
build context (relative to the repo root) — needed when the image
`COPY`s files from outside its `dir`.

Catladder generates a `🐳 image <name>` job (setup stage) that builds
the image content-hashed into the project registry
(`…/job-images/<name>:<hash>`) and skips when it already exists — works
on GitLab and GitHub.

**The build context is not hashed** (it can be the whole repo) — only
the Dockerfile / `dir`, `buildArgs` and `hashExtraPaths` are. Files
pulled in via `COPY` that should trigger a rebuild belong in
`hashExtraPaths`.

Generation (`yarn catenv`) fails fast on an undeclared image name, a
missing `dir`, or a `dir` without a `Dockerfile`.

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
- `catladder-migrate-package-manager` — migrating a project from yarn
  to pnpm (or back)
