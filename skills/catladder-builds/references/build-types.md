# catladder build config reference

Full options for `components.<name>.build` (and top-level `builds`).
Fix build problems in `catladder.ts` and regenerate — never edit the
generated pipeline files.

## Shared base options (all standalone build types)

| Option | Type | Purpose / default |
|---|---|---|
| `buildCommand` | `string \| string[] \| null \| false` | build step; `false`/`null` skips it |
| `startCommand` | `string` | runtime start command |
| `postInstall` | `string \| string[]` | runs after `yarn install` (node family) |
| `lint` / `test` / `audit` | `false \| TestJobCustom` | customize or disable the job |
| `artifactsPaths` | `string[]` | extra artifacts (`dist`, `.next` always included) |
| `artifactsExcludePaths` | `string[]` | artifact excludes |
| `artifactsReports` | `{ junit?: string[] }` | CI test report paths |
| `cache` | `CacheConfig \| CacheConfig[]` | build caching (`jobCache` is deprecated) |
| `jobVars` | `EnvVars` | env vars only in build jobs |
| `runnerVariables` | `Record<string,string>` | extra runner vars (also for `services:`) |
| `jobTags` | `string[]` | runner tags |
| `jobImage` | `GitlabJobImage` | custom CI image for the build |
| `docker` | see below | the deployable image strategy |

`TestJobCustom` (for `lint`/`test`/`audit`): `command`, `jobImage`,
`artifactsReports`, `artifacts`, `runnerVariables`, `allowFailure`
(`allowFailure` defaults to `true` for `audit`).

## Per-type options & defaults

### `node`
- `docker?` — built-in node image `{ type: "node", yarnRebuildEnabled?: boolean (default true), additionsBegin?: string[], additionsEnd?: string[] }`, or a custom docker config.
- Defaults: `buildCommand: "yarn build"`, `startCommand: "yarn start"`, artifacts `["dist", ".next"]`, excludes `[".next/cache/**/*"]`.

### `rails`
- `test?.databaseImage?` — test DB container image (Postgres only; default `docker.io/postgres:latest`).
- `cnbBuilder?` — Cloud Native Buildpacks config, used only when there is **no `Dockerfile`**:
  - `image?` — builder image. **Actual runtime default `heroku/builder:24`** (the type's JSDoc saying `heroku/buildpacks:20` is stale).
  - `packVersion?` — pack CLI version. **Actual runtime default `0.36.4`** (JSDoc `0.28.0` is stale).
  - `packExtraArgs?: string[]` — extra args passed to `pack`.
  - `buildVars?: Record<string, string | undefined>` — Bundler / Rails asset-precompile vars (`undefined` inherits from the component's env vars).

### `meteor`
- `installScripts?: boolean` — run `yarn install` inside the source folder in the image (only needed with custom image scripts).
- `docker?` — meteor built-in or custom. Default `startCommand: "node main.js"`.

### `custom`
- `type: "custom"` — **required**.
- `jobImage: GitlabJobImage` — **required** CI image.
- `docker: BuildConfigDocker` — **required** image build config.
- `jobServices?: Services` — services for lint/test/audit/build jobs.
- `lint?` / `test?` / `audit?: TestJobCustom` — disabled unless set.

### `node-static` / `storybook` — deprecated
Use `type: "node"` with `docker: { type: "nginx" }` (and
`startCommand: ""` for a purely static app). `storybook` previously
defaulted `buildCommand: "yarn build-storybook --quiet -o ./dist"`.

## `docker` sub-config

`BuildConfigDocker` is either:

- **built-in**: `{ type: "nginx" | "node" | "meteor", additionsBegin?: string[], additionsEnd?: string[] }` — `additionsBegin`/`additionsEnd` inject Dockerfile lines before/after the standard steps.
- **custom**: `{ type: "custom", buildContextLocation?: "root" | "component" (default "root"), dockerfileContent?: string[] }` — expects a `Dockerfile`. `dockerfileContent` is experimental and supports the `$DOCKER_COPY_WORKSPACE_FILES` / `$DOCKER_COPY_AND_INSTALL_APP` placeholders.

## Workspace builds (`builds`)

Top-level `builds: Record<string, WorkspaceBuildConfig>`. Only
`type: "node"` is supported.

- Node workspace build: `dir?`, `buildCommand?` (default `yarn build`), `dockerDefaults?: { yarnRebuildEnabled }`, plus shared `lint?` (default `{ command: "yarn lint" }`), `test?` (default `{ command: "yarn test" }`), `audit?`, `runnerVariables?`, `artifactsReports?`, `jobImage?`, `jobTags?`, `cache?`.
- A component references it via `build: { from: "<name>", docker?, startCommand?, artifactsPaths?, artifactsExcludePaths?, cache? }` — the per-component overrides layer on top of the shared build.
