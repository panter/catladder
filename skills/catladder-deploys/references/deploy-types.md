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
- `cloudSql?: DeployConfigCloudRunCloudSql | false` — `{ type: "unmanaged", instanceConnectionName, dbUser?, dbNamePrefix?, dbBaseName?, deleteDatabaseOnStop?, dbConnectionStringFormat? ("prisma" default | "rails" | "jdbc"), dbConnectionStringVariablesMode? ("environment" default | "embedded"), dbAdditionalQueryParams? }`.
- `execute?: Record<string, DeployConfigCloudRunExecute | null>` — run a script / job / HTTP call at a lifecycle point (`when`: `preDeploy` | `postDeploy` | `preStop` | `postStop`) or on a `schedule`.
- `debug?: boolean`.

## `dockerTag`

- `type: "dockerTag"`, `tag: string` — **required**. Adds a custom tag on the image repo to deploy it. Only used in one project historically; not generally recommended (runtime env vars must be coordinated manually).

## `custom`

- `type: "custom"` — **required**.
- `requiresDocker: boolean` — **required**; whether the deploy needs a built Docker image.
- `script: string[]` — **required**; the deploy script.
- `requiresYarnInstall?: boolean` — whether the script needs `yarn install`.
- `stopScript?: string[]` — script to stop/tear down the environment.
- `jobImage?: GitlabJobImage`.
- Also accepts `cache` (via `WithCacheConfig`).
