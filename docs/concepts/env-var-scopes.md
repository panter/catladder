# Concept: scoping env vars and secrets to where they are needed

Status: **draft for review** (bead `cat-vju`). No code changes in this PR yet.
If the concept is approved, the implementation follows in this same PR/branch
(`feat/env-var-scopes`).

Related: `cat-92k.3` (which GCP viewer roles can read deployed secrets, and
moving Cloud Run secrets to Secret Manager). That spike is about _how a secret
is stored once it reaches the runtime_. This concept is about _whether it
should reach the runtime (or the build, or the deploy job) at all_. The two
compose: a smaller runtime set means fewer secrets to move.

## 1. Problem

Every var and secret declared in `vars` of a component is injected everywhere:
into the running service, the build job, the lint/test jobs, the deploy job,
custom jobs, verify jobs, the generated `.env` files and `catenv`. That was a
deliberate simplification ("all variables are available on build-time and
run-time", `apps/docs/docs/2_environment_variables.md`). It widens the blast
radius of every secret:

- A deploy-only credential ends up in the running service.
- A runtime-only DB password is in every build and test job, and in the
  `.env` written during the build.
- Build-only tokens (e.g. a private registry token) are pushed to production.
- Anything that can read a Cloud Run revision / Kubernetes secret / CI job
  environment can read all of it.

`build.jobVars` and `deploy.jobVars` were added as a workaround, but they only
_narrow_ in one direction (var exists only in that job) and cannot express
"everywhere except runtime". The rest of the model stays unscoped.

## 2. Current state

### 2.1 Where vars and secrets are defined

| #   | Source                                                                                                                                                | Where in code                                                                                                                                                                                                                   | Notes                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D1  | `vars.public` of component / `env.<name>.vars`                                                                                                        | `types/config.ts` (`EnvVars`), merged in `context/getEnvironmentVariables.ts`                                                                                                                                                   | checked in; `${VAR}` and `${component:VAR}` references; values stringified     |
| D2  | `vars.secret` (record with `kind` / `hidden`, or deprecated `string[]`)                                                                               | `types/config.ts` (`SecretVarKind`, `SecretVarConfig`), `context/utils/envVars.ts` (`normalizeSecretVarsConfig`)                                                                                                                | value lives in the vault; job sees `$CL_<secretsEnv>_<component>_<KEY>`        |
| D3  | `env.<name>.vars` overrides (arrays are replaced, functions merge)                                                                                    | `AddOverrideFunction` in `types/config.ts`; example `override-secrets.ts`                                                                                                                                                       | per-env override of D1/D2                                                      |
| D4  | env `inherit` (`config` and `secrets` axes)                                                                                                           | `EnvironmentInheritConfig`; `secretsEnv` in the environment context                                                                                                                                                             | `secrets: "dev"` makes the env read `CL_DEV_*`; all or nothing                 |
| D5  | `build.jobVars`                                                                                                                                       | `build/types.ts` (`BuildConfigBase.jobVars`), `context/transformJobOnlyVars.ts`                                                                                                                                                 | build-time jobs only; no cross-component references                            |
| D6  | `deploy.jobVars`                                                                                                                                      | `deploy/types/base.ts`, same transform                                                                                                                                                                                          | deploy/stop/rollback jobs only; no cross-component references                  |
| D7  | predefined vars: `ENV_SHORT`, `ENV_TYPE`, `APP_DIR`, `BUILD_INFO_*`, `HOSTNAME`, `ROOT_URL`, `HOSTNAME_INTERNAL`, `ROOT_URL_INTERNAL`, `PORT` (local) | `getBasePredefinedVariables`                                                                                                                                                                                                    | not declared by users                                                          |
| D8  | deploy-type derived vars (`DB_*`, `DATABASE_URL`, `DATABASE_JDBC_URL`, `KUBE_*`, ...)                                                                 | `DEPLOY_TYPES[type].getAdditionalEnvVars` (`deploy/index.ts`, `deploy/cloudRun/index.ts`, `deploy/kubernetes/index.ts`)                                                                                                         | merged into the same flat map as D1/D2                                         |
| D9  | deploy-type derived secret keys                                                                                                                       | `DEPLOY_TYPES[type].additionalSecretKeys`: cloud run `GCLOUD_DEPLOY_credentialsKey` (hidden) and `DB_PASSWORD`; kubernetes `MONGODB_ROOT_PASSWORD`, `MONGODB_REPLICASET_KEY`, `POSTGRESQL_PASSWORD`, `cloudsqlProxyCredentials` | secret keys the user never declares, also merged into the flat map             |
| D10 | runner variables (`runnerVariables`)                                                                                                                  | `build/types.ts`, `deploy/types/base.ts`                                                                                                                                                                                        | CI runner tuning, not app env; out of scope                                    |
| D11 | gitlab project variables / github secrets that are not catladder vars (`KUBE_*` tokens, registry creds, `CI_*`)                                       | read by scripts via `getSecretVarNameForContext`                                                                                                                                                                                | implicitly visible to _every_ gitlab job; github injects only referenced names |

The merge result is one flat map per component and env
(`getEnvironmentVariables.ts`): `{...predefined, ...secrets, ...public}`, then
references resolved across the merged map. Only `jobOnlyVars` (D5, D6) are kept
separate.

### 2.2 Where they are consumed

| Consumer                                           | Gets                                                                                                                                        | Code                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run service / job runtime                    | all `envVars` except `GCLOUD_DEPLOY_credentialsKey` (hardcoded `omit`), written to an env-vars yaml file                                    | `deploy/cloudRun/createJobs/getCloudRunDeployScripts.ts`                                                                  |
| Kubernetes runtime                                 | all `envVars`; values containing `$CL_` go to a k8s Secret, the rest to a ConfigMap-style public set                                        | `deploy/kubernetes/kubeEnv.ts`                                                                                            |
| Build job (`🔨 build`, all build types)            | all `envVars` + `jobOnlyVars.build`                                                                                                         | `build/base/createAppBuildJob.ts` (rails: `build/rails/build.ts`)                                                         |
| `.env` written inside the build job                | all `envVars` except `BUILD_INFO_*`, unless `dotEnv: "local"`/`false`                                                                       | `build/base/writeDotEnv.ts`; excluded from artifacts by `createBuildJobArtifact.ts`                                       |
| lint / test / audit jobs                           | **only** `jobOnlyVars.build` (+ `APP_PATH`)                                                                                                 | `build/node/testJob.ts`, `build/custom/testJob.ts`, `build/rails/testJob.ts`                                              |
| post-build test jobs                               | `jobOnlyVars.build` (+ `test.vars`)                                                                                                         | `postBuildTest/createPostBuildTestJobs.ts`                                                                                |
| deploy / stop / rollback jobs                      | deploy: all `envVars` + docker vars + `jobOnlyVars.deploy`; stop/rollback: **only** `jobOnlyVars.deploy`                                    | `deploy/base/deploy.ts`, `stop.ts`, `rollback.ts`                                                                         |
| verify jobs                                        | all `envVars`                                                                                                                               | `verify/createVerifyJobs.ts`                                                                                              |
| custom jobs                                        | all `envVars` + job variables                                                                                                               | `pipeline/createJobsForComponent.ts` (`injectDefaultVarsInCustomJobs`)                                                    |
| agent jobs                                         | their own variables                                                                                                                         | `pipeline/agent/shared.ts`                                                                                                |
| `catenv` / local `.env` / `env.d.ts`               | `envVars` of the `local` env, secrets resolved from the vault; hidden keys filtered; `jobOnlyVars` available to `getJobOnlyEnvVarsResolved` | `apps/cli/src/config/getProjectConfig.ts`, `apps/cli/src/apps/catenv/*`                                                   |
| github backend                                     | secret names collected from `secretEnvVarKeys` + both `jobOnlyVars.*.secretEnvVarKeys` and injected per job when referenced by the script   | `backends/github/createGithubJobs.ts`                                                                                     |
| secrets CLI (vault, sync, scope, `config-secrets`) | union of `secretEnvVarKeys` + both jobOnly key sets                                                                                         | `apps/cli/src/vault/VaultManager.ts`, `secrets/writeSecrets.ts`, `secrets/github.ts`, `commands/project/secrets/scope.ts` |
| review apps                                        | same as their env type (`review`); `inherit` can reuse another env's secret values                                                          | `inherit` handling in `getSecretsEnv`                                                                                     |

### 2.3 Matrix: who can see a var today

`●` = visible, `○` = not visible, `◐` = only jobVars of that kind.

| Var kind                                                  |   runtime   | build job |     .env in build      | lint/test | deploy | stop/rollback | verify | custom jobs |              local              |
| --------------------------------------------------------- | :---------: | :-------: | :--------------------: | :-------: | :----: | :-----------: | :----: | :---------: | :-----------------------------: |
| `vars.public`                                             |      ●      |     ●     |           ●            |     ○     |   ●    |       ○       |   ●    |      ●      |                ●                |
| `vars.secret`                                             |      ●      |     ●     |           ●            |     ○     |   ●    |       ○       |   ●    |      ●      |                ●                |
| `build.jobVars`                                           |      ○      |     ●     |           ○            |     ●     |   ○    |       ○       |   ○    |      ○      | ◐ (`getJobOnlyEnvVarsResolved`) |
| `deploy.jobVars`                                          |      ○      |     ○     |           ○            |     ○     |   ●    |       ●       |   ○    |      ○      |                ◐                |
| predefined (D7)                                           |      ●      |     ●     | ● (not `BUILD_INFO_*`) |     ○     |   ●    |       ○       |   ●    |      ●      |           ● (partly)            |
| `GCLOUD_DEPLOY_credentialsKey`                            | ○ (omitted) |     ●     |           ●            |     ○     |   ●    |       ○       |   ●    |      ●      |                ○                |
| `DB_PASSWORD` (cloud sql)                                 |      ●      |     ●     |           ●            |     ○     |   ●    |       ○       |   ●    |      ●      |                ●                |
| `MONGODB_ROOT_PASSWORD`, `cloudsqlProxyCredentials` (k8s) |      ●      |     ●     |           ●            |     ○     |   ●    |       ○       |   ●    |      ●      |                ●                |

Observations:

1. The default is "everywhere", with test/lint as an accidental exception
   (they never received component `envVars`).
2. The exception for stop/rollback is _also_ accidental: they only get
   `jobOnlyVars.deploy`, so a script that needs a normal var in a rollback
   silently has it empty.
3. Deploy-time credentials leak into the runtime on Kubernetes and into the
   build job (and `.env`) on both Cloud Run and Kubernetes.

### 2.4 Existing workarounds and inconsistencies

- `omit(envVars, GCLOUD_DEPLOY_CREDENTIALS_KEY)` in
  `getCloudRunDeployScripts.ts`: a hardcoded one-off scope exclusion, there is
  no equivalent for Kubernetes secrets such as `cloudsqlProxyCredentials`.
- `hidden: true` in `SecretVarConfig` / `GCLOUD_DEPLOY_credentialsKey`: hides
  the key from `config-secrets` and from local resolution. It is a UI flag, it
  does not change who receives the value.
- `build.jobVars` / `deploy.jobVars` (examples `native-app.ts`,
  `custom-deploy.ts`): job-only vars, but (a) they have no cross-component
  references (`transformJobOnlyVars.ts` "currently does not resolve
  references"), (b) they cannot hold derived vars, (c) a name collision with a
  component var is resolved by spread order, silently, (d) they exist twice
  with duplicated docs, (e) lint/test jobs get build `jobVars` but not normal
  vars, which is surprising.
- `dotEnv: true | "local" | false` is a coarse local/build scope switch for the
  `.env` file only.
- `_ALL_ENV_VAR_KEYS` (`getEnvironmentVariables.ts`, `addIndexVar`) lists every
  key, including ones a consumer should not see.
- `env.d.ts` generation (`apps/cli/src/apps/catenv/writeEnvDTs.ts`) types
  every var for every consumer.
- `kubeEnv.ts` decides secret vs. public purely by `value.includes("$CL_")`,
  a heuristic instead of using the declared kind.
- `kind: "variable"` (non-sensitive vault value) and `kind: "secret"` already
  exist: the data model has a precedent for per-var attributes that change how
  a value is handled. Scopes can follow the same shape.
- gitlab exposes all project variables implicitly to every job, whatever
  catladder declares (D11); github does not. So "scoping" is only enforceable
  on the vault side for github and is best-effort on gitlab (see section 6).

## 3. Goals and non-goals

Goals

- A var or secret can declare where it is needed; everything else does not get
  it.
- Today's behavior stays the default. Opting in narrows, never silently.
- One model replaces `jobVars` (which becomes sugar and is deprecated).
- Derived/built-in vars and deploy-type secrets declare their scopes too.
- References stay usable and remain safe: a var can never be exposed to a
  scope its dependency does not live in without the user knowing.

Non-goals

- Moving secrets to Secret Manager (`cat-92k.3`).
- Changing the vault layout (`CL_<env>_<component>_<KEY>` stays).
- Per-job allowlists in this iteration (see open question Q4).

## 4. Proposed target model

### 4.1 Scopes

A **scope** is a consumer class. Initial set:

| Scope     | Consumers                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `runtime` | the deployed service / job / worker pool (Cloud Run env, Kubernetes env)                                  |
| `build`   | build job, `.env` written during the build, lint/test/audit, post-build tests                             |
| `deploy`  | deploy, stop, rollback jobs (and deploy-type helper jobs such as migrations that run in the deploy stage) |
| `jobs`    | verify jobs and custom jobs (`customJobs`), agent jobs                                                    |
| `local`   | `catenv`, local `.env`, `env.d.ts`                                                                        |

`jobs:<name>` (individual job names) is deliberately left for later (Q4);
`jobs` as a group covers the common case.

Convenience aliases for common cases: `"all"` (default) and `"ci"` (=
`build`, `deploy`, `jobs`).

### 4.2 Declaring scopes

A var or secret gets an optional `scopes` array. Default `"all"`, which equals
today's behavior.

Public vars: a value is either a literal (all scopes) or `{ value, scopes }`.
Secrets: the existing object form (`SecretVarConfig`) gains `scopes`.

```ts
vars: {
  public: {
    LOG_LEVEL: "info",                                    // all scopes
    NEXT_PUBLIC_API: { value: "${api:ROOT_URL}", scopes: ["build", "runtime"] },
  },
  secret: {
    SESSION_SECRET: { kind: "secret", scopes: ["runtime", "local"] },
    NPM_TOKEN:      { kind: "secret", scopes: ["build"] },
    SENTRY_AUTH_TOKEN: { kind: "secret", scopes: ["build", "deploy"] },
    PROJECT_ID:     "variable",                           // string shorthand: all scopes
  },
}
```

Rules:

1. Omitted `scopes` = `"all"`. Existing configs are unaffected.
2. A key may be declared more than once only if the declarations have disjoint
   scopes (e.g. a different `DATABASE_URL` for `build` and `runtime`).
   Overlap is a generation-time error, not a silent override like `jobVars`
   today.
3. The vault is keyed per key, not per scope: one secret value, injected in
   the declared scopes only. Disjoint duplicate declarations of a _secret_
   key would collide on the same vault name, so they need a naming rule (Q3);
   for public vars they are unproblematic.
4. The deprecated `string[]` form stays `all`.

### 4.3 Composition with env overrides and `inherit`

- `env.<name>.vars` overrides merge per key, including the `scopes` attribute.
  Overriding the value of a var keeps its scopes unless the override sets them.
  This also fixes the existing sharp edge where arrays replace entirely: the
  record form merges by key, as it does today.
- `inherit.config` carries scopes along with the vars (they are part of the
  per-component override).
- `inherit.secrets` is orthogonal: it chooses _which env's values_ are used;
  scopes decide _where_ they go.
- `local` is a scope, not an env. The `local` env still defines which values
  `catenv` resolves; a var without the `local` scope is not resolved for it.
  This removes the vault round-trip for secrets that local development never
  needs (they will not show up in `catenv` or require a developer to hold them).

### 4.4 References

A reference `${X}` or `${component:X}` is resolved _per scope_. The set of vars
visible in scope S is `visible(S)`. When resolving a var `V` for scope S, every
reference in `V` must be in `visible(S)`.

Generation-time validation, in this order:

1. Compute `scopes(V)` for each var.
2. For each reference `V -> X`, require `scopes(V) ⊆ scopes(X)`; otherwise the
   error names both vars and the offending scope, e.g.
   `API_URL (runtime) references NPM_TOKEN which is only available in build`.
3. Cross-component references follow the same rule, using the target
   component's declared scopes. This is a gain over `jobVars`, which cannot
   reference other components at all.

Rule 2 is intentionally strict. The alternative (resolving to empty) would
hide misconfiguration; the strict form turns "silently empty in prod" into a
build failure.

### 4.5 Predefined and derived vars

Every non-user var gets a default scope set, declared next to its definition
instead of being implicit:

| Var                                                                              | Default scopes               | Why                                                      |
| -------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `ENV_SHORT`, `ENV_TYPE`, `APP_DIR`                                               | all                          | harmless identifiers                                     |
| `HOSTNAME`, `ROOT_URL`, `*_INTERNAL`, `PORT`                                     | all                          | needed at runtime and for build-time inlining            |
| `BUILD_INFO_*`                                                                   | build, deploy, jobs, runtime | not written into `.env` today either                     |
| `DB_NAME`, `DB_USER`, `DB_HOST`, `DATABASE_URL`, `DATABASE_JDBC_URL` (cloud run) | runtime, deploy, local       | build/test do not need a database; deploy creates the DB |
| `DB_PASSWORD`                                                                    | runtime, deploy, local       | same                                                     |
| `GCLOUD_DEPLOY_credentialsKey`                                                   | deploy only                  | replaces the hardcoded `omit`                            |
| `MONGODB_ROOT_PASSWORD`, `MONGODB_REPLICASET_KEY`                                | deploy, runtime              | helm install/upgrade and the app connection              |
| `POSTGRESQL_PASSWORD`                                                            | deploy, runtime              | same                                                     |
| `cloudsqlProxyCredentials`                                                       | deploy only                  | consumed by the proxy sidecar setup in the deploy job    |
| `KUBE_NAMESPACE`, `KUBE_APP_NAME`, ...                                           | deploy, runtime              | as today, scoped explicitly                              |
| `_ALL_ENV_VAR_KEYS`                                                              | computed per scope           | lists only keys visible in that scope                    |

`additionalSecretKeys` returns `{ key, hidden?, scopes? }`, and
`getAdditionalEnvVars` returns a record whose entries can carry scopes the
same way (a small helper `scoped(value, scopes)`). The listed defaults are the
_proposal_; each one needs a check against the deploy scripts before the
implementation flips it (Q1). Where unsure, a derived var keeps `all` in the
first release and is narrowed in a follow-up.

### 4.6 What the pipeline does with scopes

One function replaces the scattered `...context.environment.envVars` /
`jobOnlyVars.*` spreads:

```ts
varsFor(context, "build"); // => UnspecifiedEnvVars
varsFor(context, "runtime");
varsFor(context, "deploy");
varsFor(context, "jobs");
varsFor(context, "local");
```

`getEnvironmentVariables` returns the full map plus per-var scopes;
`varsFor` filters. All consumers in section 2.2 switch to it:
`createAppBuildJob`, the test jobs, `deploy.ts` / `stop.ts` / `rollback.ts`,
`getCloudRunDeployScripts` (replaces `omit`), `createKubeEnv`,
`createVerifyJobs`, `injectDefaultVarsInCustomJobs`, `writeDotEnv`, the CLI.
Backends (`createGithubJobs`) collect the secret names per job from the same
data, so github jobs get exactly the secrets their scope includes.

### 4.7 The CLI

- `config-secrets`, `secrets-list` etc. show the scopes next to each key.
- `secrets-push` rejects keys that are not declared (unchanged); scopes do not
  affect what can be pushed.
- `catenv` resolves only `local`-scoped vars; `catladder` warns when a key it
  was asked for is out of scope.
- `env.d.ts` types per scope (a var out of scope for `local` is not typed).

## 5. Before/after examples

### 5.1 `cloud-run-with-sql-reuse-db.ts` (derived DB vars)

Before: `api` and `worker` both run on Cloud Run with `cloudSql`. The derived
`DB_PASSWORD`, `DATABASE_URL`, `DATABASE_JDBC_URL` are in the build, lint,
verify, custom jobs and the `.env` of both components.

After (no config change needed): the defaults from 4.5 put the DB vars in
`runtime`, `deploy`, `local` only. The override in the worker stays valid:

```ts
vars: {
  public: {
    DB_PASSWORD: "${api:DB_PASSWORD}",   // worker/runtime references api/runtime: ok
  },
}
```

The `worker` override inherits the default scopes of `DB_PASSWORD`; the
reference check passes because `api:DB_PASSWORD` is visible in all of
`worker`'s scopes. If someone declared the override with `scopes: ["build"]`,
generation would fail with a clear message.

### 5.2 `native-app.ts` (jobVars)

Before:

```ts
vars: {
  public: { GRAPHQL_URL: "${api:ROOT_URL}/graphql" },
  secret: ["APP_STORE_CONNECT_API_KEY_CONTENT", "APP_STORE_CONNECT_ISSUER_ID", "APP_STORE_CONNECT_API_KEY_ID"],
},
build:  { jobVars: { public: { LC_A: "L=en_US.UTF-8", LANG: "en_US.UTF-8" } }, ... },
deploy: { type: "custom", jobVars: { public: { LC_A: "...", LANG: "..." } }, ... },
```

After:

```ts
vars: {
  public: {
    GRAPHQL_URL: "${api:ROOT_URL}/graphql",
    LC_A: { value: "L=en_US.UTF-8", scopes: ["build", "deploy"] },
    LANG: { value: "en_US.UTF-8", scopes: ["build", "deploy"] },
  },
  secret: {
    // the app store keys are only needed by the fastlane deploy job; this app
    // is a native client with no runtime
    APP_STORE_CONNECT_API_KEY_CONTENT: { scopes: ["deploy", "local"] },
    APP_STORE_CONNECT_ISSUER_ID:       { scopes: ["deploy", "local"] },
    APP_STORE_CONNECT_API_KEY_ID:      { scopes: ["deploy", "local"] },
  },
},
build: { /* no jobVars */ },
deploy: { type: "custom", /* no jobVars */ },
```

Gain: the App Store Connect keys are no longer in the `bundle exec fastlane
build` job nor in the `.env` of the iOS build, and the duplicated `LC_A` /
`LANG` are one declaration.

### 5.3 `custom-deploy.ts` (deploy-only secret)

Before:

```ts
deploy: { type: "custom", requiresDocker: true, jobVars: { secret: ["DEPLOY_API_KEY"] }, ... }
```

After:

```ts
vars: {
  secret: { DEPLOY_API_KEY: { scopes: ["deploy"] } },
},
deploy: { type: "custom", requiresDocker: true, ... }
```

Same behavior, and now it works the same as every other var: it can be
overridden per env (`env.review.vars`), can be referenced from other deploy-
scoped vars, and shows up in the secrets CLI listing like everything else.

### 5.4 A web app with a build-time token and a runtime secret (new)

```ts
vars: {
  public: { NEXT_PUBLIC_API_URL: { value: "${api:ROOT_URL}", scopes: ["build", "runtime"] } },
  secret: {
    NPM_TOKEN:      { scopes: ["build"] },                  // private registry
    SESSION_SECRET: { scopes: ["runtime", "local"] },
    SENTRY_AUTH_TOKEN: { scopes: ["build", "deploy"] },     // upload source maps
  },
},
```

The running service no longer holds `NPM_TOKEN` or `SENTRY_AUTH_TOKEN`; the
build and test jobs no longer hold `SESSION_SECRET`.

## 6. Enforcement boundaries

Scopes are a catladder-level guarantee. They govern what catladder injects.
They cannot reduce what the CI platform itself exposes:

- gitlab: project variables are implicitly available in every job. A
  `CL_..._NPM_TOKEN` stored as a gitlab variable is visible to the deploy job
  environment even if catladder does not reference it. Scoping on gitlab is
  therefore "what is written into scripts, `.env`, the service and the
  generated job `variables:`" until the vault is decoupled from gitlab
  variables (`secrets.vault: bitwarden` already allows that; CI then receives
  mirrored copies, see `SecretsVaultConfig`). Open question Q5: do we use
  gitlab's `environment_scope` / protected variables later?
- github: secrets are injected per job only when referenced, so scopes map
  directly onto the job env.
- Cloud Run / Kubernetes: scoping what is pushed to the service is exact.

The docs must say this plainly, otherwise "scoped" reads as stronger than it is
on gitlab.

## 7. Backwards compatibility and migration

- **Default stays `all`.** An existing config generates the same pipeline, with
  two deliberate exceptions listed below. Snapshot tests for existing
  examples must stay unchanged except those.
- **Derived-var narrowing (4.5) is the only behavior change** for untouched
  configs. Options: (a) ship it behind `scopes: { derived: "legacy" | "strict" }`
  defaulting to `legacy` in a minor and `strict` in the next major; (b) narrow
  only the clearly safe ones in a minor (`GCLOUD_DEPLOY_credentialsKey` is
  already omitted from the Cloud Run service; making it deploy-only is
  invisible there, and removes it from the build/verify/custom job envs).
  Recommended: (b) for the deploy credentials, (a) for the rest.
- `build.jobVars` / `deploy.jobVars`: kept, marked `@deprecated`, lowered to
  the same internal form (`scopes: ["build"]` / `["deploy"]`) so there is one
  code path. A `catladder project doctor` check suggests the rewrite.
  Note the behavior differences once lowered: jobVars cannot reference other
  components today, scoped vars can (a relaxation, not a break); jobVars win
  over component vars on collision today, disjoint-scope declarations replace
  that rule and overlap becomes an error. A collision between a `jobVars` key
  and a component var of the same name stays "jobVars wins" for deprecated
  entries to avoid breaking existing configs.
- `string[]` secrets stay valid (`all`).
- **Major version?** Not required for the opt-in model plus the (b)/(a) path
  above. The final flip of derived defaults and the removal of `jobVars` are
  major-version changes. The `skills/` (`catladder-config`, `catladder-secrets`,
  `catladder-deploys`) and `apps/docs/docs/2_environment_variables.md` must be
  updated in the implementation change (project rule), including
  "Where to use env-vars", which currently states everything is available
  everywhere.
- A project-wide default scope set is not proposed in the first iteration; see
  Q2.

## 8. Alternatives considered

### A. Per-var `scopes` attribute (recommended)

As described in section 4.

- (+) Composes with env overrides, `inherit`, references, `kind` / `hidden`.
- (+) One declaration site per var; scope visible right where the secret is
  declared.
- (+) Backwards compatible by default; small API addition.
- (+) Replaces `jobVars` and `omit` hacks with the same mechanism.
- (-) Public vars gain an object form (`{ value, scopes }`) alongside literals.
- (-) The same key in two scopes with different values needs a rule (Q3).

### B. Scope-first buckets (generalize `jobVars`)

```ts
vars: {
  runtime: { public: {...}, secret: {...} },
  build:   { public: {...}, secret: {...} },
  deploy:  { ... },
  local:   { ... },
  shared:  { ... },   // today's `public`/`secret`
}
```

- (+) Very readable grouping; closest to what `jobVars` already is.
- (+) Same key with a different value per scope is natural.
- (-) A var needed in two scopes is declared twice, or lives in a `shared`
  bucket plus exceptions. Easy to drift apart.
- (-) Env overrides and `inherit` need merge rules per bucket; the number of
  overrides multiplies.
- (-) Cross-bucket references become the main complexity (section 4.4 applies
  anyway).
- (-) Does not map onto derived vars without inventing buckets for them.

B is worthwhile as sugar later (it lowers to A), but a worse primary
representation.

### C. Allow/deny filters at the consumer

Each consumer states which keys it wants: `deploy: { exposeVars: [...] }`,
`build: { excludeVars: [...] }`.

- (+) Quick to add one consumer at a time.
- (-) The knowledge lives away from the secret. Forgetting a new var means it
  leaks by default (deny lists) or breaks silently (allow lists).
- (-) A per-consumer config on every build and deploy type multiplies
  surface.
- (-) Derived vars still need defaults, which is a model we would reinvent.

### D. Naming convention / prefixes (`BUILD_`, `RUNTIME_`)

- (+) Zero config surface.
- (-) Changes var names the app sees; breaks existing apps and frameworks
  that already expect specific names (`NEXT_PUBLIC_*`, `DATABASE_URL`).
- (-) Not expressive enough (`build` and `deploy` together, `local`).
- Rejected.

### Recommendation

Go with **A** (per-var `scopes`), implemented through a single
`varsFor(context, scope)` seam, with **B** left open as sugar and **C**
rejected. A is the only option that is backwards compatible by default and
makes references, env overrides and derived vars work with one mechanism.

## 9. Open questions for maw

- **Q1.** Derived-var defaults (4.5): do you agree with the proposed table,
  or should the first release keep `all` for everything except the deploy
  credentials? Each narrowing needs a check against the deploy scripts
  (`MONGODB_*`, `POSTGRESQL_PASSWORD`, `KUBE_*`).
- **Q2.** A project- or component-level default (`defaultScopes`) so a project
  can opt into "secrets are `runtime` only unless stated"? Safer by default,
  but a second source of truth. I would leave it out of the first iteration.
- **Q3.** Same key, different value per scope (`DATABASE_URL` for build vs
  runtime): allow it (needs a vault naming rule such as
  `CL_<env>_<comp>_<KEY>` for the first declaration and a suffixed name for
  others) or keep it as one value per key and require two key names? I lean
  towards one value per key in the first iteration.
- **Q4.** `jobs` as a group, or also `jobs:<job-name>` targets (e.g. only the
  `playwright` post-build test)? Group first, names later?
- **Q5.** gitlab: is it in scope to also tighten gitlab-level exposure
  (`environment_scope`, protected variables, vault decoupling) or do we only
  document that scoping is "what catladder injects" (section 6)?
- **Q6.** Should lint/test jobs get `build`-scoped component vars (today they
  do not receive normal `vars` at all, only `build.jobVars`)? Moving them under
  `build` is the consistent choice but widens what test jobs see compared to
  today for untouched configs. Alternative: a separate `test` scope.
- **Q7.** Stop/rollback jobs today see only `deploy.jobVars`; under the
  model they would see all `deploy`-scoped vars. Is the wider set acceptable
  (it is what the deploy job sees), or do those jobs deserve their own scope?
- **Q8.** The `local` scope: should it also gate what the secrets CLI allows to
  `pull` to a developer machine (a way to keep production-only secrets away
  from laptops), or stay a pure resolution filter?

## 10. Implementation plan (slices, follow-up in this PR)

1. **Model + seam (no behavior change).** Add `scopes` to `SecretVarConfig`,
   the public var object form, and the per-var scope data in
   `getEnvironmentVariables`. Introduce `varsFor(context, scope)` returning
   today's sets for the default `all`. Snapshot tests unchanged.
2. **Switch consumers to `varsFor`.** Build, test, deploy/stop/rollback, verify,
   custom jobs, `writeDotEnv`, Cloud Run env file, `createKubeEnv`. Still
   no behavior change; remove the `omit` special case in favor of
   `GCLOUD_DEPLOY_credentialsKey: deploy`.
3. **Validation.** Reference scope check (4.4), duplicate/overlap detection,
   clear error messages, tests for each failure.
4. **Backends and CLI.** github per-job secret collection from the seam,
   `catenv` / `.env` / `env.d.ts` honor `local`, secrets CLI prints scopes,
   `_ALL_ENV_VAR_KEYS` per scope.
5. **`jobVars` lowering and deprecation.** Same internal path, doctor hint,
   `@deprecated` docs, migrate `native-app.ts` and `custom-deploy.ts` to the
   new form (with test snapshots showing the narrowing).
6. **Derived-var defaults.** Narrow per Q1 (deploy credentials first), one PR
   section per deploy type, snapshot diffs reviewed by hand.
7. **Docs and skills.** `apps/docs/docs/2_environment_variables.md`,
   `skills/catladder-config`, `catladder-secrets`, `catladder-deploys`
   (project rule: user-facing behavior and skills change in the same
   change), regenerate `skills/catladder-cli/references/commands.md`, and run
   `pnpm build && pnpm catenv` so the committed `.catladder-generated`
   bundle matches.

Rough size: slices 1-3 are the core and mostly mechanical (the consumers are
all in section 2.2); 4 and 6 carry the review risk; 7 is required for merge.
