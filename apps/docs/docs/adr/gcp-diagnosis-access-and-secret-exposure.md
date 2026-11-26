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

Research update: **2026-11-24**, Google Cloud SDK **591.0.0**
(core 2026.10.26). Commands used:

```sh
gcloud version
gcloud auth list
gcloud projects list
for role in run.viewer cloudscheduler.viewer monitoring.viewer errorreporting.viewer cloudsql.viewer cloudtrace.user logging.viewer cloudtrace.viewer; do
  gcloud iam roles describe "roles/$role" --format='value(includedPermissions)'
done
```

`auth list` reported no credentialed accounts. `projects list` and all eight
`roles describe` calls failed with "You do not currently have an active account
selected." No interactive login was attempted. **Role contents are not verified
by gcloud**, including whether `roles/cloudtrace.viewer` exists. Published Google
references support the distinctions below, but do not replace tests with isolated
principals in a throwaway GCP project.

The audit-log exposure and notification-channel masking claims are both
**not verified: no GCP project available on 2026-11-24**. The Cloud Trace
read-only claim was checked against published documentation on that date;
its live IAM verification remains blocked by missing credentials. See the
Cloud Trace permission review below and follow-up cat-q5o2 for the live checks.
Status remains proposed; no preset is declared newly safe by this review.

## Q1: which viewer roles can read secret values?

| Role                                       | Reads secret values?                    | Why                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles/run.viewer`                         | **Yes**                                 | `run.services/jobs/revisions/executions.get\|list` return the full resource including `template.containers[].env` with plain values. Only env vars that already reference Secret Manager are hidden (the reference is shown, not the value).                                                                                                                                            |
| `roles/cloudscheduler.viewer`              | **Yes, if secrets are in headers/body** | `cloudscheduler.jobs.get\|list` return `httpTarget.headers` and `body`. Catladder's own `job` schedules carry no secret (OAuth service account, no header), but user-declared `http` schedules can.                                                                                                                                                                                     |
| `roles/monitoring.viewer`                  | Unverified (channel secrets)            | Metrics, dashboards, alert policies. The notification-channel GET reference says private key material may be truncated or omitted; this is not a blanket masking guarantee. **Not verified: no GCP project available on 2026-11-24** (cat-q5o2).                                                                                                                                        |
| `roles/errorreporting.viewer`              | Indirectly                              | Grouped error events with stack traces and messages. Contains whatever the app puts in an exception message — same exposure as logs, not env.                                                                                                                                                                                                                                           |
| `roles/cloudsql.viewer`                    | No                                      | Instance and database metadata, user **names** only. Passwords are never returned. Note the Cloud SQL `DB_PASSWORD` is an env var, so it leaks through `run.viewer`, not through this role.                                                                                                                                                                                             |
| `roles/cloudtrace.user`                    | Indirectly                              | Trace spans with attributes (URLs, sometimes request data). Not env. Published role documentation grants task and trace-scope writes, so it is not strictly read-only (details below). Live IAM contents not verified: no credentials on 2026-11-24.                                                                                                                                    |
| `roles/logging.viewer` (the `logs` preset) | Indirectly                              | Application logs can contain anything the app prints. Additionally the `_Required` bucket holds Admin Activity audit logs; for Cloud Run deploys the audit entry's `request` may include the service spec with env values. **Not verified: no GCP project available on 2026-11-24** (cat-q5o2). If present, `logs` exposes secrets and requires the Secret Manager migration below too. |

Conclusion: **`run.viewer` and, for `http` schedules, `cloudscheduler.viewer`
are not safe presets while secrets are deployed as env vars.** The
monitoring / error reporting / Cloud SQL rows describe their expected scope,
not a live verification of role contents or notification-channel masking.

### Cloud Trace permission review (2026-11-24)

The [published Cloud Trace role reference](https://docs.cloud.google.com/iam/docs/roles-permissions/cloudtrace)
lists these write-capable permissions for `roles/cloudtrace.user`:

- `cloudtrace.tasks.create`, `cloudtrace.tasks.delete`;
- `cloudtrace.traceScopes.create`, `cloudtrace.traceScopes.delete`, `cloudtrace.traceScopes.update`;
- `observability.traceScopes.create`, `observability.traceScopes.delete`, `observability.traceScopes.update`.

It reads spans without granting `cloudtrace.traces.patch` or
`telemetry.traces.write`. The reference lists Admin, User and Agent roles,
with no `roles/cloudtrace.viewer` entry. That absence is documentation evidence,
not an authenticated not-found result: the attempted viewer describe also failed
for lack of credentials. Do not substitute a broad viewer role; a read-only
alternative still needs IAM validation and a separate preset design.

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

Secret delivery and migration are tracked separately in spike
[cat-jqhh (panter/catladder#61)](https://github.com/panter/catladder/issues/61).
Today, `--env-vars-file` stores secrets as plain env vars on Cloud Run
resources; moving to Secret Manager references is the prerequisite for
considering the `runtime` preset. That spike owns the mechanism, IAM,
cost, effort and rollout analysis.

## Decision / recommendation

Presets, in order of rollout:

| Preset     | Roles                                                              | Ready now?                                                                                                       |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `logs`     | `roles/logging.viewer`                                             | **Gated** pending the live audit-log exposure check in cat-q5o2; implementation exists, safety is unverified     |
| `diagnose` | `logs` + `roles/monitoring.viewer` + `roles/errorreporting.viewer` | **Gated** on the `logs` check and notification-channel masking test in cat-q5o2                                  |
| `database` | `roles/cloudsql.viewer` (metadata only; DB content is slice 4)     | Proposed; low value on its own, live IAM contents unverified (no credentials, 2026-11-24)                        |
| `runtime`  | `roles/run.viewer` (+ `roles/cloudscheduler.viewer`)               | **No** — only after the Secret Manager migration in cat-jqhh is the default and schedule headers are secret-free |
| `traces`   | `roles/cloudtrace.user`                                            | **No** as a read-only preset: documented task and trace-scope writes; alternative unverified                     |

`diagnose` covers the original need (why did job execution X fail): the
execution's log stream gives the cause and Monitoring gives the
`result`/count signal, without `run.*`.

## Follow-ups

- **cat-q5o2 (maw-city/catladder)**:
  run the live checks in a throwaway GCP project with logging-only and
  monitoring-only principals. Deploy/update a disposable Cloud Run marker env
  var, inspect Admin Activity request/response for it, then GET/LIST a webhook
  notification channel with a disposable sensitive token label. Record results,
  date and SDK version; clean up all resources and credentials. Also rerun all
  eight IAM describes, including the possible Cloud Trace viewer alternative.
  Keep `logs`/`diagnose` gated until these results resolve the exposure question;
  if audit logs expose env, require the Secret Manager migration too.
- Follow [cat-jqhh (panter/catladder#61)](https://github.com/panter/catladder/issues/61)
  for Secret Manager delivery, deploy IAM and rollout decisions.
- After the live checks resolve the gates, add the `diagnose` preset
  (logs + monitoring + errorreporting) to the
  declaration schema and the `catladder-deploys` skill.
- Warn in docs/`catladder-deploys` skill: no secrets in Cloud Scheduler
  `http` headers/body.

## References for factual corrections

- [Cloud Trace roles and permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/cloudtrace):
  `cloudtrace.user` reads traces and manages tasks and trace scopes; trace writing
  is granted by other roles.
- [Cloud Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit):
  Admin Activity audit logs are stored in `_Required`.
- [Notification channel GET](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.notificationChannels/get):
  private key material may be truncated or omitted; live masking is unverified.
