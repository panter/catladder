# yarn → pnpm: what actually differs

Companion to the `catladder-migrate-package-manager` skill. Everything
here has bitten a real catladder project during a migration.

## Command mapping

| yarn | pnpm |
|---|---|
| `yarn` / `yarn install` | `pnpm install` |
| `yarn install --immutable` (`--frozen-lockfile` classic) | `pnpm install --frozen-lockfile` |
| `yarn add x` / `yarn add -D x` | `pnpm add x` / `pnpm add -D x` |
| `yarn remove x` | `pnpm remove x` |
| `yarn up x` (berry) | `pnpm update x` |
| `yarn <script>` | `pnpm <script>` (or `pnpm run <script>`) |
| `yarn workspace pkg <script>` | `pnpm --filter pkg <script>` |
| `yarn workspaces foreach …` | `pnpm -r <script>` |
| `yarn workspaces focus --production` | `pnpm install --prod --filter pkg...` |
| `yarn run -T x` / `yarn -T x` (berry top-level) | `x` (root `node_modules/.bin` is on the script PATH) |
| `yarn dlx x` | `pnpm dlx x` |
| `yarn node x` / `yarn exec x` | `pnpm exec x` |
| `yarn npm audit --environment production --all --recursive` | `pnpm audit --prod` |
| `yarn bin x` | `pnpm bin x` |

## Configuration mapping

| yarn | pnpm |
|---|---|
| package.json `workspaces` | `packages:` in `pnpm-workspace.yaml` |
| package.json `resolutions` | `overrides:` in `pnpm-workspace.yaml` |
| `.yarn/patches/*` + `patch:` resolutions | `patchedDependencies:` in `pnpm-workspace.yaml` |
| `.yarnrc.yml` settings | `pnpm-workspace.yaml` (auth/registry stay in `.npmrc`) |
| `.yarnrc.yml` `npmScopes` / auth | `.npmrc` |
| `catalog:` / `catalogs:` in `.yarnrc.yml` | `catalog:` / `catalogs:` in `pnpm-workspace.yaml` |
| (yarn runs install scripts by default) | `allowBuilds:` map — pnpm 11; `onlyBuiltDependencies:` list on pnpm 10 |
| `.yarn/cache` (zip cache) | the content-addressable store (catladder points it at a project-local `.pnpm-store`) |

**pnpm 11 reads settings from `pnpm-workspace.yaml` only.** A
`pnpm` section in package.json (`pnpm.overrides`,
`pnpm.patchedDependencies`) works on pnpm 10 and is *silently ignored*
on 11 — the opposite of what most migration guides written for pnpm 10
say. `.npmrc` keeps auth/registry settings and nothing else.

## Behavioral differences that break things

**No hoisting → phantom dependencies.** yarn flattens
`node_modules`, so a package you never declared is importable anyway.
pnpm's symlinked layout does not. Every undeclared import fails —
sometimes only inside the production docker image, where the bundler is
no longer there to paper over it. The fix is always to declare the
dependency; `shamefully-hoist` only postpones the failure.

**Install scripts are opt-in.** `pnpm install` skips dependency build
scripts and prints the list. Anything with a native build or a
generator step (prisma, esbuild, sharp, playwright, husky, …) needs an
`allowBuilds` entry, or it is missing at runtime.

**The root `prepare` script runs during `--prod` installs.** In the
docker image, devDependencies are gone: `"prepare": "husky"` fails the
build. Use `"prepare": "husky || true"`.

**`pnpm run` writes a banner to stdout.** yarn does not. Any script
whose output is piped or captured (`pnpm build:x > out.json`, generated
supergraph schemas, …) must use `pnpm --silent run …`.

**Scripts run in `sh`, not yarn's built-in shell.** yarn berry ships a
POSIX-ish shell that expands `**` recursively; `sh` does not. An
unquoted `./src/**/*.ts` silently matches *fewer* files. Quote the
pattern and let the receiving tool expand it. This is the failure mode
that ships a container missing half its entrypoints and still boots the
build job green.

**No root-script fallback.** yarn berry falls back to the root
package's scripts when a workspace has none; pnpm errors. Inline shared
scripts into each workspace, or add a thin per-workspace wrapper.

**`--frozen-lockfile` verifies every importer.** pnpm checks that every
workspace listed in the lockfile exists on disk, and that every
`patchedDependencies` patch file is present with the right hash — which
is why catladder copies all workspace manifests and all patch files into
the docker build context.

**Version drift in `--prod` installs.** `pnpm install --prod` on a
node_modules tree from a *different* lockfile does not prune orphaned
`.pnpm` directories — never reuse one branch's node_modules for another
lockfile, and never a yarn tree for a pnpm branch.

**Nothing is cached.** A yarn pipeline caches its zip cache and
node_modules; a pnpm pipeline caches neither, and does not copy a store
into docker images either. pnpm installs a 3800-package monorepo from
the registry in 30-40s, which is less than it costs to move a 1 GB
store or a 1.3 GB node_modules tree through a CI cache — measured
side-by-side, caching made jobs about twice as slow on gitlab. Two
consequences when migrating: CI pulls more from the registry than the
yarn setup did (worth a registry proxy if that matters to you), and
`.pnpm-store` should not appear anywhere in the repo or a build
context.

**Docker images must not carry the store.** If a store is copied into
an image, it lands in a layer below `node_modules`, pnpm cannot hardlink
across the overlay boundary, and every package is copied instead — the
install gets *slower* (28s vs 10s from the registry) and the image
carries the packages twice. Let the `--prod` install download, into a
store outside the app directory that the same `RUN` layer deletes.

**pnpm 11 needs node ≥ 22.13** (pnpm 10: ≥ 18.12), and it does not fail
politely: it prints a `warn:` line and then crashes on
`No such built-in module: node:sqlite`. In CI this bites even when the
job image ships node 22 — the jobs run `nvm install` from `.nvmrc`, so
an `.nvmrc` of `20` downgrades the image right before the install.

**`pnpm audit` needs no scope flags.** It audits every workspace and the
whole transitive tree by default, which is what `yarn npm audit` only does
with `--all --recursive` (without them it checks the current workspace's
*direct* dependencies — in a monorepo root that is usually nothing at all).
Expect the pnpm audit job to surface vulnerabilities the yarn one never
reported. In return `--prod` is stricter than yarn's
`--environment production`: yarn still reports a devDependency of a
workspace, pnpm does not.

**`minimumReleaseAge`** defaults to 1440 minutes on pnpm 11: freshly
published versions are refused. Set it to `0` while migrating (it is a
supply-chain feature worth enabling deliberately later, not something to
discover mid-migration).

## catladder-specific notes

- The `packageManager` field feeds the pnpm version installed in the
  docker build; corepack's `+sha512…` integrity suffix is stripped.
- `build: { type: "meteor" }` is yarn-only in catladder and fails
  generation under pnpm.
- `docker: { yarnRebuildEnabled }` applies to yarn berry only.
- The job image ships pnpm; custom `jobImage`s and custom
  `dockerfileContent` images get a `npm install -g pnpm@<version>`
  fallback injected, so they work too — but they pay for it on every job.
