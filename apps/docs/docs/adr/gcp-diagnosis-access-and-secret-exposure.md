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

| Role                                       | Reads secret values?                    | Why                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `roles/run.viewer`                         | **Yes**                                 | `run.services/jobs/revisions/executions.get\|list` return the full resource including `template.containers[].env` with plain values. Only env vars that already reference Secret Manager are hidden (the reference is shown, not the value).                                                                                                           |
| `roles/cloudscheduler.viewer`              | **Yes, if secrets are in headers/body** | `cloudscheduler.jobs.get\|list` return `httpTarget.headers` and `body`. Catladder's own `job` schedules carry no secret (OAuth service account, no header), but user-declared `http` schedules can.                                                                                                                                                    |
| `roles/monitoring.viewer`                  | No                                      | Metrics, dashboards, alert policies. Notification channel labels that are sensitive are masked by Google _(verify)_.                                                                                                                                                                                                                                   |
| `roles/errorreporting.viewer`              | Indirectly                              | Grouped error events with stack traces and messages. Contains whatever the app puts in an exception message — same exposure as logs, not env.                                                                                                                                                                                                          |
| `roles/cloudsql.viewer`                    | No                                      | Instance and database metadata, user **names** only. Passwords are never returned. Note the Cloud SQL `DB_PASSWORD` is an env var, so it leaks through `run.viewer`, not through this role.                                                                                                                                                            |
| `roles/cloudtrace.user`                    | Indirectly                              | Trace spans with attributes (URLs, sometimes request data). Not env. Reads traces but also grants task and trace-scope management permissions, so it is not strictly read-only; review those permissions before adding a preset.                                                                                                                       |
| `roles/logging.viewer` (the `logs` preset) | Indirectly                              | Application logs can contain anything the app prints. Additionally the `_Required` bucket holds Admin Activity audit logs; for Cloud Run deploys the audit entry's `request` may include the service spec with env values _(verify; if true, `logs` already exposes secrets and the Secret Manager migration below is a prerequisite for it as well)_. |

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
| `logs`     | `roles/logging.viewer`                                             | Yes (slice 1), after verifying the audit-log question above                                                      |
| `diagnose` | `logs` + `roles/monitoring.viewer` + `roles/errorreporting.viewer` | After the same audit-log check as `logs`; the added roles do not read env                                        |
| `database` | `roles/cloudsql.viewer` (metadata only; DB content is slice 4)     | Yes, low value on its own                                                                                        |
| `runtime`  | `roles/run.viewer` (+ `roles/cloudscheduler.viewer`)               | **No** — only after the Secret Manager migration in cat-jqhh is the default and schedule headers are secret-free |
| `traces`   | `roles/cloudtrace.user`                                            | Later, review task and trace-scope management permissions                                                        |

`diagnose` covers the original need (why did job execution X fail): the
execution's log stream gives the cause and Monitoring gives the
`result`/count signal, without `run.*`.

## Follow-ups

- Verify the _(verify)_ items with a throwaway project and amend this ADR.
- Follow [cat-jqhh (panter/catladder#61)](https://github.com/panter/catladder/issues/61)
  for Secret Manager delivery, deploy IAM and rollout decisions.
- Add the `diagnose` preset (logs + monitoring + errorreporting) to the
  declaration schema and the `catladder-deploys` skill.
- Warn in docs/`catladder-deploys` skill: no secrets in Cloud Scheduler
  `http` headers/body.

## References for factual corrections

- [Cloud Trace roles and permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/cloudtrace):
  `cloudtrace.user` reads traces and manages tasks and trace scopes; trace writing
  is granted by other roles.
- [Cloud Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit):
  Admin Activity audit logs are stored in `_Required`.
