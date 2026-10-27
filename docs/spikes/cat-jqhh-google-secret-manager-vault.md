# Spike: Google Cloud Secret Manager as a catladder vault (next to Bitwarden), and runtime secrets read directly from it   (cat-jqhh)

Status: partially answered

Research only; no `gcloud` or Bitwarden was available in the spike environment, so nothing was run against a real GCP
project. Everything below is from the repo sources, PR #51/#55/#60 and Google's official docs. Cost figures could not be
verified (see Open risks).

## Answer

A `GoogleSecretManagerVault` fits the existing `SecretsVault` interface (`id`, `readAllSecrets`, `writeSecrets`)
without changes to `VaultManager` or the local cache: it only has to map `CL_<ENV>_<COMPONENT>_<KEY>` names to Secret
Manager secrets and back. Runtime secrets from Secret Manager are feasible on Cloud Run through
`--set-secrets ENV=SECRET:VERSION` (pinned version) or volume mounts; this is a change to the generated deploy scripts
and to the runtime service account (`roles/secretmanager.secretAccessor`, which #51 makes addressable). It should be
built after #55's `runtime` scope exists, because "which secrets go to the runtime" is exactly what #55 decides.
Kubernetes and other deploy types are out of reach for a first slice.

## Evidence

### 1. Vault backend

Existing interface (`apps/cli/src/vault/types.ts`):

- `id: string` — identity incl. config, used to invalidate `.catladder/secrets.json` when the vault changes.
- `readAllSecrets(io): Promise<Record<string,string>>` — flat map of raw names `CL_<ENV>_<COMPONENT>_<KEY>` -> value.
- `writeSecrets(io, env, componentName, secrets, options?)` — upsert of one env/component; `options.backup` ("keep the
  previous value where the store supports it").

`VaultManager.createVault()` is a `switch (vaultConfig.type)` over `gitlab | bitwarden`; `SecretsVaultConfig`
(`packages/pipeline/src/types/config.ts`) is the matching union. Adding `{ type: "google-secret-manager"; project?;
prefix? }` touches exactly these two places plus the CLI. Caching is vault-agnostic: only the `local` env is cached
(`CACHED_ENV`), keyed by `vault.id`, so `id = "gsm:<projectId>"` is enough.

Mapping (proposal), one Secret Manager secret per value (unlike Bitwarden's one yaml note per env/component):

- Secret ID `catladder-<customer>-<app>-<env>-<component>-<KEY>`. Allowed: letters, digits, `-`, `_`, max 255 chars
  (docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets). catladder `KEY`s are upper-snake and
  `sanitizeForEnVar` is already applied to env/component, so IDs are valid. Hierarchy can additionally go into
  **labels** (`catladder-env`, `catladder-component`, `catladder-app`) so `readAllSecrets` can use
  `gcloud secrets list --filter=labels...` instead of parsing names.
- Versions: Secret Manager versions every write natively. `writeSecrets` = `versions add`; this gives the `backup`
  option for free (old versions stay, unlike the gitlab store's `<KEY>_backup_<timestamp>` variables). Old versions
  should be disabled/destroyed by policy, they cost money while enabled.
- One secret per key makes `writeSecrets` a true upsert (Bitwarden has to read-merge-rewrite the whole note), and
  per-secret IAM becomes possible — useful for #55 scopes and for `localAccess`-style least privilege.
- `readAllSecrets` = list + N x `access latest`: N API calls instead of one. With ~50 secrets this is seconds; the local
  cache for `local` stays important. Quota: 90,000 access requests/min/project
  (docs.cloud.google.com/secret-manager/quotas), irrelevant at catladder scale. Payload limit 64 KiB per version
  (same page) — fine for env values, but `cloudsqlProxyCredentials` / service-account JSON keys are ~2.4 KiB, ok.
- Values are strings; catladder already `JSON.stringify`s non-strings.

IAM (proposal):

| Principal | Role | Scope |
| --- | --- | --- |
| developers | `secretmanager.admin` or `secretVersionAdder` + `viewer` + `accessor` | project, or per secret by label condition |
| CI deploy SA (`cl-d-*`) | `secretmanager.secretAccessor` (read at deploy, for mirroring) | project |
| runtime SA (`cl-r-*`, #51) | `secretmanager.secretAccessor` on **only** its component's runtime secrets | per secret |

Role names beyond `secretAccessor`/`admin` come from my knowledge of the IAM reference; the fetched docs page did not list
them, so verify before implementing.

Provisioning: `project setup` already enables APIs from a list (`apps/cli/src/apps/cli/commands/project/setup/setupCloudRun.ts:26`,
`apps/cli/src/gcloud/enableServices.ts`: `gcloud services enable <svc> --project=<id>`) — add `secretmanager.googleapis.com`;
`doctor` already checks required services (`checkCloudRun.ts`). The vault needs a GCP project: default to the component's
Cloud Run project, configurable.

### 2. Runtime secrets

Today (`packages/pipeline/src/deploy/cloudRun/createJobs/getCloudRunDeployScripts.ts`): all `envVars` except
`GCLOUD_DEPLOY_credentialsKey` are written as YAML to a file and passed via `--env-vars-file` to services
(`cloudRunServices.ts:54`), jobs (`cloudRunJobs.ts:57`) and worker pools (`cloudRunWorkerPools.ts:42`). Secret values
therefore travel as plain env values in the revision spec: anyone with `run.services.get` can read them (this is the
concern behind cat-92k.3 / #55).

Cloud Run official docs (docs.cloud.google.com/run/docs/configuring/services/secrets, .../jobs/secrets):

- Env var: `gcloud run deploy SERVICE --image IMAGE --update-secrets=ENV_VAR_NAME=SECRET_NAME:VERSION`
  (jobs: `gcloud run jobs update JOB --set-secrets ENV_VAR_NAME=SECRET_NAME:VERSION`).
- Env vars are "resolved at instance startup time"; if retrieval fails "the instance doesn't start". Google recommends
  **pinning a version** instead of `latest` for env vars.
- Volume mount: always fetches on read, i.e. follows `latest`; fits rotation; failures show up as read errors at runtime.
- Cloud Run checks at deploy that the service identity can access the secret.
- Service identity needs `roles/secretmanager.secretAccessor`; deployer needs `roles/iam.serviceAccountUser` on that
  identity (the `cl-d` SA already has this project-wide, per #51's description).
- Cross-project: `projects/PROJECT_NUMBER/secrets/NAME:VERSION`. Regional secrets are not supported.
- The services page also covers services; the worker-pool secrets page was not fetched — worker pool support must be
  verified (`gcloud beta run worker-pools deploy` is used by catladder).

Design implications:

- Pinned versions + catladder: the deploy script resolves `latest` to a number (`gcloud secrets versions list`) or reads
  the version that catladder just wrote, and pins it in the flags. A secret change then requires a redeploy (consistent
  with today's model where `secrets-set` only affects the next deploy). `latest` for env vars would silently change on
  the next cold start — avoid as default, offer as opt-in.
- Env-vs-file: `--env-vars-file` and `--set-secrets` can coexist; secret keys are simply removed from the YAML file and
  added as `--set-secrets` pairs. `--set-secrets` replaces all secrets of the revision, which gives idempotent deploys.
  A secret key that is also a plain env key conflicts (gcloud rejects the same name in both) — one more reason for the
  public/secret split from #55.
- Runtime SA: without `runtimeServiceAccount` (#51) the service runs as the default compute SA (`roles/editor` usually),
  which can already read all secrets in the project — Secret Manager would give no isolation. So `runtimeServiceAccount`
  (#51) is a **prerequisite** for the security benefit; setup would additionally grant the `cl-r-*` SA
  `secretAccessor` on exactly the component's runtime secrets (same place #51 binds `roles/cloudsql.client`).
- "read directly at runtime" (the app calls the Secret Manager API itself) needs no catladder deploy change other than
  the IAM binding; catladder would only provide the secret names (e.g. as plain env vars) — a possible later option, not
  recommended as the default because env/volume injection avoids app-side SDK code.
- Other deploy types: Kubernetes (`deploy/kubernetes/kubeEnv.ts`) builds a k8s Secret from `$CL_` values; Secret Manager
  there needs External Secrets Operator or the CSI driver — separate, bigger decision. `dockerTag`/`custom`/`npmPackage`
  do not have a runtime. CI-only secrets (`GCLOUD_DEPLOY_credentialsKey`, registry tokens) stay in CI variables: Secret
  Manager access itself needs credentials, so the bootstrap secret cannot live in it.

### 3. Fit with PR #55 (draft, docs-only, `docs/concepts/env-var-scopes.md` on `feat/env-var-scopes`)

#55 introduces per-var `scopes` (`runtime`, `build`, `deploy`, `jobs`, `local`) and a `varsFor(context, scope)` seam.
It explicitly lists "moving secrets to Secret Manager (cat-92k.3)" as a non-goal and says the two compose.

| Secret class (#55 scope) | Where it should live with GSM | Reason |
| --- | --- | --- |
| `runtime` only (session secret, DB password) | GSM, injected with `--set-secrets` | the case this spike is about; smaller blast radius |
| `runtime` + `local` | GSM (vault) and local cache | developers resolve via vault, runtime via Cloud Run secret |
| `build`, `deploy`, `jobs` (NPM_TOKEN, Sentry, store keys) | vault: GSM or Bitwarden; mirrored to CI variables as today | CI needs plain values in job env |
| CI platform / bootstrap (`GCLOUD_DEPLOY_credentialsKey`, KUBE tokens) | CI variables only | needed to reach GSM at all |
| public vars | unchanged | not secret |

What must land from #55 first: the data model (`scopes`) and `varsFor(context, "runtime")` (slices 1–2). Without it,
"all `vars.secret` go to the runtime" is the only available rule, so `--set-secrets` would just move *all* secrets,
including build-only ones, into Secret Manager references — works, but defeats the least-privilege point and creates IAM
for secrets the runtime never needs. #55's Q3 (same key, different value per scope) matters: Secret Manager IDs are per
key, so one-value-per-key (the author's leaning) maps 1:1. #55 section 6 notes GitLab exposes all project variables to
all jobs; as vault `google-secret-manager` decouples source of truth from CI variables (like `bitwarden` today), a
runtime-only secret would not need to be mirrored to CI at all, which is the one place scoping becomes truly enforced on
GitLab. That requires `collectSecretTargets` / `mirrorSecretsToCiBackends` (`apps/cli/src/secrets/`) to skip
runtime-only secrets — depends on #55 slice 4.

### 4. Migration and coexistence

- One-off command: `catladder project secrets migrate --from bitwarden --to google-secret-manager` implemented as
  `readAllSecrets` of the old vault + `writeSecrets` per env/component into the new one. The write path already exists
  (`writeSecretsAndMirror`, `apps/cli/src/secrets/writeSecrets.ts`), and there is a precedent in `secrets pull/push`
  commands (`apps/cli/src/commands/project/secrets/`).
- Coexistence: `config.secrets.vault` is a single value, so exactly one vault is the source of truth per project at a
  time. Hold both for a transition by adding the new vault, running migrate, switching the config, and keeping the old
  vault read-only for rollback. A dual-write mode is not needed.
- Rollback: switch `secrets.vault` back (the cache is invalidated by `vault.id`). Deployed Cloud Run revisions keep their
  pinned versions, so rollback of a vault does not affect running services. Cloud Run's own revision rollback
  (`rollback` job) restores the pinned versions of that revision — another benefit of pinning; versions must not be
  destroyed while a rollback target references them (retention rule needed).
- Existing deployed services: switching a service from `--env-vars-file` secrets to `--set-secrets` happens on the next
  deploy; gcloud flags make it a replace, so old plain env entries must be removed in the same deploy
  (`--remove-env-vars` or full `--env-vars-file` rewrite without the secret keys), else gcloud errors on the duplicate.

### 5. Costs, limits and local access

- Limits verified: 64 KiB per version, 90,000 access requests/min/project (docs.cloud.google.com/secret-manager/quotas);
  secret IDs: letters/digits/`-`/`_`, max 255 chars.
- Pricing: the pricing page returned truncated content to my fetch; from memory (unverified) roughly $0.06 per active
  version/month, $0.03 per 10k access operations, small free tier. For ~100 secrets with a few versions each this is
  low single-digit USD/month; **verify at cloud.google.com/secret-manager/pricing before committing**.
- Access calls: deploy-time version resolution = O(secrets) metadata calls per deploy; runtime env var resolution is
  once per instance start (so cold starts/scale-out generate accesses: autoscaling to N instances = N x secrets
  accesses) — low cost, but the startup dependency on GSM availability is new (a failing retrieval prevents the
  instance from starting, per docs).
- Local developer access: `gcloud auth login` + Application Default Credentials; catenv would shell out to `gcloud
  secrets versions access` (like it shells out to `bw`) — no unlock prompt concept, but token expiry (reauth) maps onto
  the existing `SecretsMode` (`no-prompt`, `offline`). **Relation to `localAccess` (#60, open PR)**: #60 provisions a
  read-only SA key and "stores its key in the secret store (local env only)" and states "the gitlab vault is refused
  (key would become a CI variable)". With a GSM vault, an SA key would be the bootstrap secret needed to read the vault
  itself — chicken-and-egg; for GSM the localAccess key must stay outside the vault (or use the developer's own gcloud
  identity). #60 will also need an extension to allow the new vault type. Treat the two as needing a joint decision.
- Local cache `.catladder/secrets.json` is plaintext by design and unchanged.

## Recommendation

1. Do it in this order: #55 data model + `varsFor` (slices 1–2) -> #51 runtime service account (merge) -> GSM vault ->
   Cloud Run `--set-secrets` -> migrate command. The vault alone (slice A below) is independent and can ship first as a
   Bitwarden peer, if wanted.
2. Pin versions in deploys; keep `latest` only as explicit opt-in. One Secret Manager secret per key, labelled.
3. Make GSM an additional vault type, not a replacement; keep Bitwarden and GitLab.
4. Only inject `runtime`-scoped secrets into Cloud Run via `--set-secrets`; leave Kubernetes alone.
5. Decide #60 interaction before implementing (see Open risks).

Proposed slicing (bead titles; none approved):

- A. `GoogleSecretManagerVault` (vault type, config union, naming/labels, list/read/write, unit tests with mocked gcloud,
  `project setup`/`doctor` enable API + IAM, skill + docs update).
- B. `catladder project secrets migrate` (vault -> vault).
- C. Cloud Run runtime secrets via `--set-secrets` with version pinning (needs #55 slices 1–2 and #51): deploy scripts for
  service/jobs/worker pools, `cl-r` SA `secretAccessor` bindings in setup + doctor checks, snapshot example.
- D. Skip mirroring runtime-only secrets to CI backends (needs #55 slice 4).
- E. Spike follow-up: verify worker-pool secrets flags and pricing with a real GCP project.

## Open risks / unknowns

- Nothing was executed (no `gcloud`/`bw` in this environment): `--set-secrets` with worker pools
  (`gcloud beta run worker-pools deploy`), the exact conflict behaviour of `--env-vars-file` vs `--set-secrets` for
  the same key, and real latencies are untested.
- Pricing figures are unverified (page fetch truncated).
- IAM role names other than `secretAccessor`/`admin` are from memory.
- The effort of N sequential `access` calls in `readAllSecrets` (perf) is estimated, not measured; batching is not
  offered by the API.
- #55 is still a draft with open questions Q1–Q8; #51 and #60 are open PRs. Their final shape (esp. `scopes` form, `local`
  scope semantics Q8, `localAccess` vault restriction) may change the slicing above.
- Rotation/deploy ordering: pinned versions need a defined moment when `latest` is promoted to a pinned version
  (deploy-time resolve vs a recorded version in `.catladder-store`); to be designed.
- Version retention vs Cloud Run revision rollback (do not destroy pinned versions of kept revisions).

## Decisions for maw

1. Is Secret Manager meant as an alternative vault, or should it eventually be the default for runtime secrets of Cloud
   Run projects (and Bitwarden remain a developer-side vault only)?
2. Pin versions (recommended, redeploy needed to rotate) or follow `latest` via volume mounts (rotates without redeploy)?
3. One shared GCP project for vault secrets, or the component's own project?
4. Which scope of IAM for developers: project-wide admin or label-conditioned?
5. Joint design with #60 for the bootstrap key problem.

## Follow-ups

See the beads created from this spike (listed on the source bead's dependents; created without the label `approved`).
