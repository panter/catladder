---
sidebar_label: GCP diagnosis access vs. secret exposure
---

# ADR: GCP diagnosis access and secret exposure

Status: proposed (spike result, input for the "declarative local GCP
diagnosis access" epic)

## Context

Agents working in a project cannot read Cloud Run logs headless: gcloud
uses a personal login that expires and cannot re-authenticate
non-interactively. The epic adds a per-project service account whose
read-only bindings are declared in `catladder.ts`. Slice 1 ships only
the `logs` preset, because of this finding:

- the cloudRun deploy writes **all** environment variables, secrets
  included, to a yaml file and passes it as `--env-vars-file`
  (`packages/pipeline/src/deploy/cloudRun/createJobs/getCloudRunDeployScripts.ts`
  → `cloudRunServices.ts`, `cloudRunJobs.ts`, `cloudRunWorkerPools.ts`);
- the only thing removed from that file is the deploy credentials key.

So every secret is a plain env var on the service revision, the job and
every job execution, and any role that may `get` those resources can read
it. Secrets also reach Cloud Scheduler: `http` schedules take
`headers` and `body` verbatim from `catladder.ts`
(`execute/schedules.ts`).

## How this was researched

No GCP project was available to this spike, so the role contents below
come from Google's published IAM role documentation as we know it, **not
from a live `gcloud iam roles describe` run**. Before implementing a
preset beyond `logs`, verify each claim marked _(verify)_ with
`gcloud iam roles describe roles/<role>` and a test principal in a
throwaway project.

## Q1: which viewer roles can read secret values?

| Role                                       | Reads secret values?                    | Why                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles/run.viewer`                         | **Yes**                                 | `run.services/jobs/revisions/executions.get\|list` return the full resource including `template.containers[].env` with plain values. Only env vars that already reference Secret Manager are hidden (the reference is shown, not the value).                                                                                                          |
| `roles/cloudscheduler.viewer`              | **Yes, if secrets are in headers/body** | `cloudscheduler.jobs.get\|list` return `httpTarget.headers` and `body`. Catladder's own `job` schedules carry no secret (OAuth service account, no header), but user-declared `http` schedules can.                                                                                                                                                   |
| `roles/monitoring.viewer`                  | No                                      | Metrics, dashboards, alert policies. Notification channel labels that are sensitive are masked by Google _(verify)_.                                                                                                                                                                                                                                  |
| `roles/errorreporting.viewer`              | Indirectly                              | Grouped error events with stack traces and messages. Contains whatever the app puts in an exception message — same exposure as logs, not env.                                                                                                                                                                                                         |
| `roles/cloudsql.viewer`                    | No                                      | Instance and database metadata, user **names** only. Passwords are never returned. Note the Cloud SQL `DB_PASSWORD` is an env var, so it leaks through `run.viewer`, not through this role.                                                                                                                                                           |
| `roles/cloudtrace.user`                    | Indirectly                              | Trace spans with attributes (URLs, sometimes request data). Not env. Also grants write on traces, so it is not read-only in the strict sense; prefer `roles/cloudtrace.user` only if traces are required _(verify)_.                                                                                                                                  |
| `roles/logging.viewer` (the `logs` preset) | Indirectly                              | Application logs can contain anything the app prints. Additionally the `_Default` bucket holds Admin Activity audit logs; for Cloud Run deploys the audit entry's `request` may include the service spec with env values _(verify; if true, `logs` already exposes secrets and the Secret Manager migration below is a prerequisite for it as well)_. |

Conclusion: **`run.viewer` and, for `http` schedules, `cloudscheduler.viewer`
are not safe presets while secrets are deployed as env vars.** The
monitoring / error reporting / Cloud SQL viewers do not expose env.

## Q2: can a custom role list executions without the env?

No. IAM permissions are per API method, not per field.
`run.executions.get` and `run.executions.list` return the complete
execution object including its `template` (and therefore env); there is
no field mask that hides it. A custom role can only choose which methods
are allowed, and every method that returns status also returns the
template. The same holds for `run.jobs.*`, `run.revisions.*`,
`run.services.*`.

What does work without `run.*`:

- **Status of a failed job/execution**: `logging` (the execution's
  `run.googleapis.com/job` log stream) or Cloud Monitoring metrics such
  as `run.googleapis.com/job/completed_execution_count` (labelled by
  `result`) — both covered by the `diagnose` preset below.
- **Service health**: Monitoring request count / latency / instance
  metrics.

So the lever is not a narrower role but removing secrets from the
resources (Q3).

## Q3: moving secrets to Secret Manager

### Mechanism

Cloud Run services, jobs and worker pools accept
`--set-secrets=KEY=secret-name:version` (and `--update-secrets` /
`--remove-secrets`). The container still sees a normal env var, but the
resource only stores the reference, so `run.viewer` no longer reveals the
value. Catladder already knows which variables are secret:
`secretEnvVarKeys` in `packages/pipeline/src/context/getEnvironmentVariables.ts`
(`kind: "secret"`), so the split is available at deploy time.

### Proposed deploy change

1. In `getCloudRunDeployScripts`, split `context.environment.envVars` into
   public vars (stay in `____envvars.yaml`) and secret vars (new).
2. For each secret var, before the service/job deploy, idempotently
   create or update a Secret Manager secret named e.g.
   `<environment fullName>-<KEY>` and add a new version
   (`gcloud secrets create … || true`, `gcloud secrets versions add`).
   Pin the **version number** returned by `versions add` in
   `--set-secrets`, not `latest`, so a revision stays reproducible and a
   rollback keeps its secrets.
3. Pass `--set-secrets=KEY=<secret>:<version>,…` on services, jobs and
   worker pools (`createArgsString` already builds these arg strings).
4. Stop/cleanup scripts (`getCloudRunStopScripts.ts`, review-app cleanup)
   delete the environment's secrets, otherwise every review app leaves
   secrets behind.
5. The `____envvars.yaml` must no longer contain the secret keys: a key
   present both as env var and secret is rejected by Cloud Run.
   `--env-vars-file` replaces the whole env set, so existing deployments
   migrate on the next deploy without extra flags _(verify on a service
   that was deployed the old way)_.

### Required IAM

- Runtime service account (the compute default account catladder uses,
  `getComputeServiceAccountEmail`): `roles/secretmanager.secretAccessor`.
  Granting it per secret is cleaner but needs another call per secret;
  project level is the pragmatic first step.
- Deploy service account: `secretmanager.secrets.create`,
  `secretmanager.versions.add`, `secretmanager.secrets.delete`
  (`roles/secretmanager.admin` is the smallest predefined role covering
  all three; a custom role is tighter). **This is a breaking requirement
  for existing projects** — `project setup`/`doctor` has to grant and
  check it, and the Secret Manager API must be enabled.

### Limits and costs

- Cost is small: about $0.06 per active secret version per month plus
  $0.03 per 10k accesses (an access happens per instance start, not per
  request). Destroy old versions on update to keep it flat.
- Not covered: Cloud Scheduler `headers`/`body`. Those need their own
  fix (prefer the OIDC/OAuth service account that `job` and `http`
  schedules already set, and document "do not put secrets in schedule
  headers"), or `cloudscheduler.viewer` simply stays out of presets.
- Anything the app prints still ends up in logs. Secret Manager does not
  help there.
- Env vars set by Cloud Run itself or non-secret vars are unaffected.

### Effort

Roughly 3–5 days for pipeline + tests + docs: deploy script split and
cleanup (about 2 days, snapshots change for every cloudRun example),
IAM/doctor/setup checks and the migration note (1 day), `catladder`
e2e on a real project (1–2 days). Rollout risk is the new deploy
permission; ship it behind an opt-in (`deploy.secretsViaSecretManager`)
first, make it the default in a later major.

## Decision / recommendation

Presets, in order of rollout:

| Preset     | Roles                                                              | Ready now?                                                                                                 |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `logs`     | `roles/logging.viewer`                                             | Yes (slice 1), after verifying the audit-log question above                                                |
| `diagnose` | `logs` + `roles/monitoring.viewer` + `roles/errorreporting.viewer` | Yes — none of these reads env                                                                              |
| `database` | `roles/cloudsql.viewer` (metadata only; DB content is slice 4)     | Yes, low value on its own                                                                                  |
| `runtime`  | `roles/run.viewer` (+ `roles/cloudscheduler.viewer`)               | **No** — only after the Secret Manager migration above is the default and schedule headers are secret-free |
| `traces`   | `roles/cloudtrace.user`                                            | Later, needs the "read-only" verification                                                                  |

`diagnose` covers the original need (why did job execution X fail): the
execution's log stream gives the cause and Monitoring gives the
`result`/count signal, without `run.*`.

## Follow-ups

- Verify the _(verify)_ items with a throwaway project and amend this ADR.
- Implement the Secret Manager delivery for cloudRun (opt-in), with
  deploy IAM check in `project doctor`.
- Add the `diagnose` preset (logs + monitoring + errorreporting) to the
  declaration schema and the `catladder-deploys` skill.
- Warn in docs/`catladder-deploys` skill: no secrets in Cloud Scheduler
  `http` headers/body.
