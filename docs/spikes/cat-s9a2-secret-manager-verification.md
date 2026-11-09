# Verification: Secret Manager on Cloud Run, flags and pricing (cat-s9a2)

Follow-up to [cat-jqhh](cat-jqhh-google-secret-manager-vault.md), slice A of cat-ctx7.

- Run date: 2026-11-09
- `gcloud --version`: Google Cloud SDK 591.0.0 (core 2026.10.26, bq 2.1.41, bundled-python3-unix 3.14.9,
  gcloud-crc32c 1.0.0). Components `alpha` and `beta` are **not installed**; installing them needs write access
  to `/opt/homebrew/share/google-cloud-sdk`, which this environment does not have.
- GCP project: none (`gcloud config get-value project` is `(unset)`, no account logged in).

## Status: verification is NOT complete

**No GCP resources were created, and nothing was run against a real GCP project.** Everything that can be checked
offline (flag names, pricing, IAM role names) is checked below. Every claim that needs a running project is marked
`unverifiable here` and must be checked with the live-verification script (item B, separate work item) against a disposable project before
`cat-92k.7` relies on it.

## Verdicts

| ID | Claim | Verdict |
| --- | --- | --- |
| REQ-001a | `gcloud run deploy` / `jobs deploy` have `--set-secrets`, `--update-secrets`, `--remove-secrets`, `--clear-secrets` | verified (local help) |
| REQ-001b | Worker pools accept `--update-secrets` / `--set-secrets` | verified from official docs only (see below) |
| REQ-001c | A worker pool actually starts with a secret / fails on an inaccessible one | unverifiable here, see item B |
| REQ-002a | `--env-vars-file`, `--set-env-vars`, `--update-env-vars`, `--remove-env-vars` exist | verified (local help) |
| REQ-002b | Same key in env vars and secrets conflicts (error) and removing the key from env on redeploy resolves it | unverifiable here, see item B |
| REQ-004 | "about $0.06 per active version, $0.03 per 10k accesses" | verified, with corrections (see Pricing) |
| REQ-005 | IAM role names | verified from official docs; two extra roles found |
| REQ-006 | Pinning (`ENV=SECRET:N`), `latest` resolved at instance start, disabled/destroyed pinned version behaviour | `latest`/number syntax verified from docs; the disabled/destroyed behaviour is unverifiable here |

## REQ-001 / REQ-002: flags

### Cloud Run service and job (local help, verified)

Command: `gcloud run deploy --help` and `gcloud run jobs deploy --help` (output trimmed):

```text
--clear-secrets          Remove all secrets.
--set-secrets=[KEY=VALUE,...]
                         List of key-value pairs to set as secrets. All existing secrets will be removed first.
--remove-secrets=[KEY,...]   List of secrets to be removed.
--update-secrets=[KEY=VALUE,...]   List of key-value pairs to set as secrets.
...
Keys starting with a forward slash '/' are mount paths. All other keys correspond to environment variables.
Values should be in the form SECRET_NAME:SECRET_VERSION. For example:
'--update-secrets=/secrets/api/key=mysecret:latest,ENV=othersecret:1' will mount a volume at '/secrets/api'
containing a file 'key' with the latest version of secret 'mysecret'. An environment variable named ENV will also
be created whose value is version 1 of secret 'othersecret'.

--env-vars-file=FILE_PATH
--set-env-vars=[KEY=VALUE,...]
--remove-env-vars=[KEY,...]
--update-env-vars=[KEY=VALUE,...]
(Only --update-env-vars and --remove-env-vars can be used together; --remove-env-vars is applied first.)
```

Verdict: verified. `--set-secrets` replaces all existing secrets, `--update-secrets` merges. The pin syntax is
`NAME:VERSION` (number or `latest`).

### Worker pools

Local attempt: `gcloud beta run worker-pools deploy --help` fails with
`You do not currently have this command group installed. Using it requires the installation of components: [beta]`
(cannot install: no permission on the SDK directory). `gcloud run worker-pools deploy --help` (GA path, group is
listed under `gcloud run --help`) fails with `No module named 'grpc'` in the bundled Python.
So the worker-pool flags are **not verified from local help**.

Official reference, retrieved 2026-11-09:
<https://cloud.google.com/run/docs/configuring/workerpools/secrets> (note: the URL in the earlier spike, `.../workers/secrets`,
returns 404).

- Env var at deploy: `gcloud run worker-pools deploy WORKER_POOL --image IMAGE_URL --update-secrets=ENV_VAR_NAME=SECRET_NAME:VERSION`
- Clear and set: `gcloud run worker-pools update WORKER_POOL --set-secrets="ENV_VAR_NAME=SECRET_NAME:VERSION"`
  ("to clear existing secrets and make a new secret accessible").
- Cross-project: `ENV_VAR_NAME=projects/PROJECT_NUMBER/secrets/SECRET_NAME:VERSION`.
- Env vars are resolved at instance startup; Google recommends pinning a version instead of `latest`. Volumes always
  read the latest value. Secrets are checked at deploy time (the runtime service account must have access).
- The docs use `gcloud run worker-pools` (not `gcloud beta run ...`); whether the command group is GA or beta for
  the installed version is therefore a point to recheck with `gcloud ... --help` where the component works.

Verdict: the flags exist per the docs (verified from documentation, dated above); the actual start/fail behaviour
of a pool with a secret is unverifiable here.

### Conflict behaviour (env var and secret for the same key)

Not documented explicitly in the retrieved pages and not testable offline: unverifiable here. The item B script is to run
service, job and pool with the same key in `--env-vars-file` and `--set-secrets`, then redeploys without the env
entry. Until verified, keep the spike's design assumption (remove the plain entry in the same deploy) as an
assumption, not a fact.

## REQ-004: pricing

Source: <https://cloud.google.com/secret-manager/pricing>, retrieved 2026-11-09 (raw page fetched with curl; the
earlier fetch tool truncated it). Prices in USD:

| Item | Price |
| --- | --- |
| Active secret versions | first 6 per month free; above that $0.000082192 per hour per version (= $0.06 per month, the page's own examples use $0.06) |
| Destroyed secret versions | free |
| Access operations | first 10,000 per month free; $0.03 per 10,000 above |
| Management operations | free |
| Rotation notifications | first 3 per month free; $0.05 each above |

Disabled (not destroyed) versions: the page lists "active" and "destroyed" only; whether disabled versions are
billed as active is unverifiable here.

Estimates (formulas shown so they can be rechecked):

1. 100 secrets x 3 active versions = 300 versions.
   `(300 - 6) x $0.06 = $17.64 per month`.
   With one version per secret: `(100 - 6) x $0.06 = $5.64`. Replicas in several locations multiply the count
   (the page's example bills 150 versions for 10 secrets x 3 locations x 5 versions).
2. Runtime accesses (env var resolution at instance start): `accesses = instance starts x secrets per instance`.
   Example: 20 secrets, 3,000 instance starts per month (about 100 per day) = 60,000 accesses;
   `(60,000 - 10,000) / 10,000 x $0.03 = $0.15 per month`. N instances x S secrets in one scale-out event costs
   `N x S` accesses, e.g. 50 x 20 = 1,000.
3. Deploy-time resolution of pinned versions is O(secrets) calls per deploy and is negligible next to (1).

Verdict: the "$0.06 per active version, $0.03 per 10k accesses, small free tier" figures were right, but the
conclusion "low single-digit USD per month for ~100 secrets with a few versions" is **refuted**: 300 active versions
cost about $17.64 per month. Access costs are negligible; version count is the cost driver. Destroying old versions
keeps the bill down (destroyed versions are free) but conflicts with Cloud Run revision rollback.

## REQ-005: IAM role names

Source: <https://docs.cloud.google.com/secret-manager/docs/access-control>, retrieved 2026-11-09.

| Role | Purpose |
| --- | --- |
| `roles/secretmanager.admin` | full control incl. IAM policies |
| `roles/secretmanager.editor` | create, update and delete secrets and manage versions; cannot read payloads |
| `roles/secretmanager.secretAccessor` | read payload of versions |
| `roles/secretmanager.viewer` | view metadata only |
| `roles/secretmanager.secretVersionAdder` | add new versions (rotate) |
| `roles/secretmanager.secretVersionManager` | create and manage versions, enable, disable, destroy |

All role names used in the spike (`admin`, `secretAccessor`, `secretVersionAdder`, `viewer`) are correct. The spike
did not mention `editor` and `secretVersionManager`; the latter is the least-privilege choice for the rotate/disable
flow. `gcloud iam roles describe roles/secretmanager.<role>` needs credentials and was not run.

## Live checks left open (item B)

Mark: `unverifiable here - see item B` for all of these (item B, separate work item):

- a worker pool with a secret starts; a pool with an inaccessible secret fails at deploy
- same key in env file and `--set-secrets`: error or override, for service, job and pool
- removing a key from the YAML on redeploy removes it from the revision
- `--set-secrets` idempotence on redeploy
- `ENV=SECRET:N` pinning vs `latest` at instance start
- disabled and destroyed pinned version: deploy and instance start behaviour
- real access latency

## Follow-ups

- Obtain a disposable GCP project and run the verification script; then replace the `unverifiable` verdicts here.
- Update `cat-92k.7` with the verdicts above (pricing correction, worker-pool flags from docs only).
