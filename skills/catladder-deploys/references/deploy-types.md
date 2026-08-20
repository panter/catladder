# catladder deploy config reference

Full options for `components.<name>.deploy` (and per-env
`env.<name>.deploy`). Fix deploy problems in `catladder.ts` and
regenerate — never edit generated files. Provision the underlying cloud
resources with `yarn catladder project setup`; detect drift with
`yarn catladder project doctor`.

## Shared base (all deploy types)

| Option | Type | Purpose / default |
|---|---|---|
| `when` | `"manual" \| "auto"` | prod → `manual`, other envs → `auto` |
| `waitFor` | `string[]` | EXPERIMENTAL; wait for other components first |
| `jobTags` | `string[]` | runner tags |
| `jobVars` | `EnvVars` | env vars only in the deploy job |
| `runnerVariables` | `Record<string,string>` | extra runner vars |

(Cloud Run defines its own `execute`; otherwise the base applies to all.)

## `kubernetes`

- `cluster` — **required**: `{ type: "gcloud", name, projectId, region, domainCanonical? }`.
- `debug?: boolean` — pass `--debug` to Helm.
- `additionalHelmArgs?: string[]`.
- `chartName?: string` — custom chart location (not recommended).
- `values?` — app configuration (unknown props allowed, forwarded to the chart):
  - `application?: false | { command?, enabled? (default true), redirects?, hostAliases?, replicas?, autoscale?: { minReplicas, maxReplicas, metrics[] }, updateStrategy?, resources?: { limits/requests: { cpu, memory } }, healthRoute?, startupProbe? / readinessProbe? / livenessProbe? (httpGet shape), worker?, jobDefaults? }`.
  - `cloudsql?: { type: "unmanaged", enabled, instanceConnectionName, dbUser?, dbNamePrefix?, dbBaseName? }`.
  - `mongodb?: { enabled?, dbName?, persistence?, resources?, tolerations? } & ({ architecture: "standalone" } | { architecture: "replicaset", replicaCount? (default 2) })`.
  - `mailhog?: { enabled }` — dev mail catcher (injects `MAIL_URL`).
  - `jobs?: Record<string, false | { command, hook? }>` — Helm hook jobs (default hook `post-install,post-upgrade`).
  - `cronjobs?: Record<string, false | { schedule, command, concurrencyPolicy?, timeZone? }>`.
  - `secretsFromOtherComponent?: { [envVar]: string }` — load secrets from another component in the same cluster.
  - `mapServiceUrlToEnv?: { [envVar]: string }` — map another service's internal endpoint to an env var.

## `google-cloudrun`

- `projectId` — **required**.
- `region` — **required** (`Gcloudregion` enum, e.g. `europe-west6`).
- `service?: boolean | DeployConfigCloudRunService` (default enabled):
  - `command?`, `args?`, `image?`, `minInstances?` (0), `maxInstances?` (100), `cpu?` (1|2|4|6|8), `memory?` (512MB), `timeout?` (5min), `noCpuThrottling?`, `allowUnauthenticated?` (true), `ingress?` (`all` | `internal` | `internal-and-cloud-load-balancing`, default `all`), `executionEnvironment?` (`gen1`|`gen2`), `http2?`, `gpu?`/`gpuType?`, `sessionAffinity?`, `healthCheck?` (`true` or `{ startupProbe, livenessProbe }`), plus cloud-storage volumes and VPC network config.
- `additionalServices?: Record<string, service | false | null>`.
- `jobs?: Record<string, DeployConfigCloudRunJob | false | null>` — `{ command, args?, image?, cpu?, memory? (512Mi), timeout? (10min), parallelism? (1), maxRetries? (0) }`. The per-job `when`/`schedule`/`waitForCompletion` fields are **deprecated** — use `execute`.
- `workerPools?: Record<string, DeployConfigCloudRunWorkerPool | false | null>` — always-on background work, no endpoint, no autoscaling: `{ command, instances? (1), cpu?, memory?, image?, args?, gpu?/gpuType? }`.
- `cloudSql?: DeployConfigCloudRunCloudSql | false` — `{ type: "unmanaged", instanceConnectionName, dbUser?, dbNamePrefix?, dbBaseName?, deleteDatabaseOnStop?, dbConnectionStringFormat? ("prisma" default | "rails" | "jdbc"), dbConnectionStringVariablesMode? ("embedded" default | "legacy"), dbAdditionalQueryParams? }`. Injects `DB_*` vars plus `DATABASE_URL`/`DATABASE_JDBC_URL`; in the default `"embedded"` mode the connection strings contain the component's final values (referenceable from other components, `vars.public` overrides of `DB_*` flow in). To share another component's database: `dbBaseName: "<owner>"` + `DB_PASSWORD: "${<owner>:DB_PASSWORD}"` in `vars.public`.
- `execute?: Record<string, DeployConfigCloudRunExecute | null>` — run a script / job / HTTP call at a lifecycle point (`when`: `preDeploy` | `postDeploy` | `preStop` | `postStop`) or on a `schedule`.
- `debug?: boolean`.
- Injected env vars: every env — including `local` — gets `GOOGLE_CLOUD_PROJECT` set to the deploy's `projectId`, so google client libraries (and hand-rolled code) resolve the project id from the environment without a metadata-server lookup. Deployed envs additionally get `DEPLOY_CLOUD_RUN_SERVICE_NAME` / `DEPLOY_CLOUD_RUN_PROJECT_ID` / `DEPLOY_CLOUD_RUN_REGION`. A `vars.public` entry with the same name always wins.
- Service name and url: the service deploys as `<customerName>-<appName>-<env>[-<reviewSlug>]-<componentName>`, and `ROOT_URL`/`ROOT_URL_INTERNAL` are cloud run's deterministic url `https://<service>-<projectNumber>.<region>.run.app`. That url only exists while its first dns label stays within 63 characters, so catladder **shortens the component part** of the service name when it would not fit — otherwise cloud run would serve a legacy url with a random identifier and the generated hostname would never resolve. Review environments carry a runtime slug on top, for which 8 characters are reserved, so a name can fit `dev`/`prod` and still be shortened for `review`. Generation fails instead of shortening when two components would end up with the same name, or when customerName/appName/env/project number already leave no room.

## `npmPackage`

- `type: "npmPackage"` — **required**. Publishes the component as an npm package: the deploy job stamps the derived version into `package.json` and runs `npm publish` (via catci).
- `access?: "public" | "restricted"` — npm access level, default `"public"`.
- `registry?: string` — registry url, default `https://registry.npmjs.org/`.
- `distTag?: string` — overrides the derived dist-tag.
- Version/dist-tag derivation: tagged release (`prod`) → tag version under `latest`; branch/MR → `0.0.0-<branch-slug>-<sha>` under `canary` (branches `next`/`beta` publish under their own dist-tag).
- Auth: the `NPM_TOKEN` secret (managed like any catladder secret), or — on github — **trusted publishing** with no stored token: register the package's trusted publisher on npmjs.com with the repo and the publishing **workflow filename** (`catladder-release.yml` for tagged releases). npm allows one trusted publisher per package, so canary publishes from the main/review workflows still need `NPM_TOKEN`. A set token always wins over OIDC.
- Disable staging on the component (`env: { stage: false }`) so tagged releases publish directly.

## `pages`

- `type: "pages"` — **required**. Publishes a static site on gitlab pages or github pages. On github the repo's Pages source must be set to "GitHub Actions" once; per-merge-request previews are gitlab-only (github serves one site per repository).
- `script: string[]` — **required**; produces the site.
- `publishDir?: string` — output directory relative to the repo root, default `"public"`.
- `requiresInstall?: boolean` — run the package-manager install (yarn/pnpm) first (`requiresYarnInstall` is a deprecated alias).
- `jobImage?: GitlabJobImage`; also accepts `cache`.
- Review envs publish under an `mr-<iid>` path prefix (parallel deployments → MR previews; exposed as `$PAGES_PREFIX`); other envs publish at the root. The environment url is the published pages url.
- Defaults to `allowFailure: true`.

## `dockerTag`

- `type: "dockerTag"`, `tag: string` — **required**. Adds a custom tag on the image repo to deploy it. Only used in one project historically; not generally recommended (runtime env vars must be coordinated manually).

## `custom`

- `type: "custom"` — **required**.
- `requiresDocker: boolean` — **required**; whether the deploy needs a built Docker image.
- `script: string[]` — **required**; the deploy script.
- `requiresInstall?: boolean` — whether the script needs the package-manager install (`requiresYarnInstall` is a deprecated alias).
- `stopScript?: string[]` — script to stop/tear down the environment.
- `jobImage?: GitlabJobImage`.
- Also accepts `cache` (via `WithCacheConfig`).
