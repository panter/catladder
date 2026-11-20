---
name: catladder-secrets
description: Managing environment variables and secrets in a catladder project. Use when adding or changing env vars in catladder.ts (vars.public / vars.secret), when a secret value must be set, rotated or checked, when secrets need migrating between vaults or syncing to GitHub, or when local .env / direnv environment questions come up. Triggers on "env var", "secret", "vars", "catenv", ".env", "config-secrets", "secrets-set", "secrets-list", "secrets-migrate", "switch vault", "rotate a secret", "set a secret".
---

# Env vars and secrets with catladder

Environment variables are declared per component in `catladder.ts`;
secret _values_ are never checked into the repo.

## Declaring variables

```ts
components: {
  app: {
    vars: {
      // names of secret vars — values are stored in the secrets vault, not in git
      secret: ["API_KEY"],
      public: {
        MY_VAR: "some value",
        // reference other vars, including from other components:
        GRAPHQL_ENDPOINT: "${api:ROOT_URL}/graphql",
      },
    },
  },
}
```

Predefined per component/env: `ROOT_URL`, `HOSTNAME`, `PORT` (plus
deploy-type specific ones — e.g. `google-cloudrun` injects
`GOOGLE_CLOUD_PROJECT` into every env, including `local`). A
`vars.public` entry with the same name overrides any predefined var.
All vars are available at build time and at
runtime. After changing declarations, regenerate with `yarn catenv` and
commit.

## Setting secret values

Secret values are managed through the catladder CLI — never by editing
files in the repo. All secrets commands accept a **scope**:
`dev:web` (one env of one component), `dev:` (one env, all
components), `:web` (all envs of one component), or nothing (everything).

An env that shares another env's secrets (top-level
`environments.<name>.inherit`, e.g. a `next` branch env inheriting from
dev) has **no secret store of its own** — its jobs reference the source
env's variables directly, so it never appears in secrets scopes: manage
(and rotate) the values via the source env, which affects both.

Check what is declared and what is still unset (never prints values
unless `--reveal` is passed):

```sh
yarn catladder project secrets-list
yarn catladder project secrets-list --check   # non-zero exit when something is unset
```

Set a single secret (the usual case — also for rotating one value
across all envs via the `:component` scope):

```sh
echo -n "the-value" | yarn catladder project secrets-set dev:web API_KEY
yarn catladder project secrets-set :web API_KEY --value-file /path/to/value
```

Prefer stdin or `--value-file` over `--value` so values stay out of
shell history. **Never pass a real secret value you found in the
conversation without the user having provided it for this purpose.**

Bulk-edit several secrets as a YAML document
(`component → env → key: value`):

```sh
yarn catladder project secrets-pull dev: --out /tmp/secrets.yml   # unset ones appear as "🚨 FILL ME"
# edit the file, then:
yarn catladder project secrets-push dev: --file /tmp/secrets.yml  # partial docs are fine
```

`secrets-push` skips placeholder/empty values, rejects undeclared
keys, and may be partial — only the provided keys are written. Both
support `--key KEY1,KEY2` to narrow further. Delete the temp file
afterwards; never commit it.

Humans may instead use the interactive editor flow
(`project config-secrets`, opens `$EDITOR`); as an agent, use the
commands above.

The editing commands above write to the secrets vault (the source of truth) and
automatically mirror to the enabled CI backends — which vault is
configured makes no difference to the commands.

## Migrating secrets between vaults

`project secrets-migrate [env:component] --to <vault>` copies declared
secrets between `gitlab` and `bitwarden`. Omit the scope for all
environments/components, or use the scopes above; `--key KEY1,KEY2`
narrows the selection. `--to` is required; `--from` defaults to the
configured vault. For Bitwarden, select collections with
`--from-collection` / `--to-collection` (the configured collection when
the vault type matches, otherwise `catladder`). Use explicit `--from
bitwarden` with `--from-collection` when selecting a source collection.
Source and target must identify different vaults/collections.

```sh
# preview names and counts; no writes or confirmation
pnpm catladder project secrets-migrate --to bitwarden --to-collection catladder --dry-run
# non-interactive copy after reviewing the plan
pnpm catladder project secrets-migrate --to bitwarden --to-collection catladder --yes
# copy selected keys between Bitwarden collections
pnpm catladder project secrets-migrate dev:web --from bitwarden --from-collection old --to bitwarden --to-collection new --key API_KEY --yes
```

Unset/empty source values and placeholders are skipped; equal target
values are left alone. Differing target values are conflicts unless
`--overwrite` is supplied, which replaces them with backups. Without
`--yes`, pending writes require confirmation. `--dry-run` only prints
the plan; migration output shows names/counts, never secret values.
Writes are verified by re-reading the target vault. Failed writes,
verification failures or remaining conflicts make the migration exit
non-zero.

Migration never modifies the source, changes `catladder.ts`, or mirrors
to CI. Existing CI variables remain untouched (the GitLab vault itself
stores secrets in project variables, so targeting it necessarily writes
those vault entries).

To switch vaults:

1. Preview and run migration while `secrets.vault` still points to the
   old vault. Resolve conflicts/failures before continuing.
2. Change `secrets.vault` in `catladder.ts` to the destination (including
   its Bitwarden collection), then run `pnpm catenv` and commit the config
   and generated files.
3. Re-run `project setup` for provisioned secrets as described below;
   run `project secrets-sync-github` if GitHub environment secrets need
   syncing. These are separate operations from migration.
4. Keep the old vault read-only for rollback; migration does not delete
   or disable it. Switching the config back restores the old source of
   truth, whose values may become stale after writes to the new vault.

## Provisioned secrets

A few secrets are not typed in by a human but created by
`yarn catladder project setup`: the gcloud deploy service account key
(`GCLOUD_DEPLOY_credentialsKey`) and the kubernetes deploy credentials
(`KUBE_TOKEN`, `KUBE_CA_PEM`, `KUBE_URL`). They travel the same route as
every other secret — vault first, then the enabled CI backends — but
they are _hidden_: they never show up in `secrets-list`, in the editor
or in a pulled document, and they must never be set by hand.

Re-running `project setup` **rotates** them (a fresh credential is
created and the old one revoked). That is also the answer whenever they
are missing somewhere — after switching `secrets.vault`, for instance:
a `secrets-pull`/`secrets-push` round trip does not carry hidden keys
over, so re-run `project setup` to provision them into the new vault.

## Switching vaults

To move the declared secrets from one vault to another (e.g. gitlab →
bitwarden), use `project secrets-migrate`. It copies values, never
modifies the source, never mirrors to CI backends, and never prints
values (names and counts only).

1. Make sure the target vault is usable (e.g. bitwarden login). Do **not**
   change `secrets.vault` yet: `--from` defaults to the configured vault,
   `--to` names the target (`gitlab` or `bitwarden`; bitwarden takes
   `--to-collection` / `--from-collection`, default the configured
   collection, else `catladder`). `--from-collection` also works when
   `--from` is omitted.
2. Preview: `yarn catladder project secrets-migrate --to bitwarden --dry-run`
   (scope and `--key KEY1,KEY2` work as in the other secrets commands,
   e.g. `dev:web`). Nothing is written.
3. Run it: `yarn catladder project secrets-migrate --to bitwarden`
   (`--yes` skips the confirmation, needed when non-interactive). Written
   values are read back from the target and verified.
4. Set `secrets.vault` in `catladder.ts` to the new vault, run
   `yarn catenv` and commit.
5. Keep the old vault untouched for a while: it is the rollback.

Details to know:

- Re-running is idempotent: identical values are skipped, unset
  (empty / "FILL ME") source values are skipped.
- A value that already exists in the target with a different value is a
  **conflict**: it is not overwritten, and the command exits non-zero.
  This also returns non-zero in `--dry-run`. Re-run with `--overwrite`
  to replace it (the target keeps a backup copy
  of the old value). Write or verification failures also exit non-zero;
  other components are still migrated.
- Only declared secrets are migrated. The hidden provisioned keys
  (gcloud deploy key, kube credentials) and `localAccess` service account
  keys are **not**: re-run `yarn catladder project setup` afterwards to
  provision them into the new vault.
- Migrating changes only the vault. Values in the CI backends are
  unchanged, so no redeploy is needed for the migration itself; redeploy
  (or `secrets-sync-github`) only after you actually change a value.
- Source and target must differ; the command refuses otherwise.
- Vault failures report entry names and omit backend diagnostics, which may
  contain values. Check vault access separately when a read or write fails.

## GitHub pipelines

GitHub Actions cannot read the vault at runtime; secrets are mirrored
into GitHub _environment_ secrets (one GitHub environment per catladder
env). Sync them with:

```sh
yarn catladder project secrets-sync-github
```

Run this after adding/changing secrets when a github pipeline is
enabled.

## Local development

`catenv` generates the local env (`.env` files / exported vars via
direnv) for the `local` environment. If a var is missing locally,
check its declaration in `catladder.ts` and re-run `yarn catenv` before
suspecting anything else.

### Read-only cloud access for local use

For google cloud run components, `localAccess` in `catladder.ts`
(project default at the top level, per env in `environments.<env>`,
`false` to disable) declares read-only access for local use, e.g.
`localAccess: { gcp: { presets: ["logs"] } }`. `catladder project setup`
creates a service account per component/env with exactly those roles and
stores its key in the secret store under the `local` env (never mirrored
to CI); `catladder project doctor` reports drift. `catenv` writes the key
to `.catladder/local-access/gcp-<env>-<component>.json` (0600, gitignored)
and exports its path as `CATLADDER_LOCAL_ACCESS_GCP_<ENV>_KEY_FILE` — not
as `GOOGLE_APPLICATION_CREDENTIALS`, use it with an isolated
`CLOUDSDK_CONFIG`, never `gcloud auth` on the personal config. The
`logs` preset is `roles/logging.viewer` only (project-wide); extra `roles`
must be `roles/{logging,monitoring,errorreporting}.viewer` (never `roles/viewer`/`roles/run.viewer`:
cloud run revisions carry secrets as plain env vars), unless
`allowAnyRole: true` (also needed for custom roles); write/admin roles are always rejected. Needs a
non-CI vault (e.g. bitwarden) — `project setup` refuses with the gitlab
vault. After a key rotation on another machine, run
`catenv --vault-mode refresh`.

To read Cloud Run logs with that key use
`catladder logs <env>:<component> [--job <name>] [--execution <id>] [--since 1h] [--severity ERROR] [--limit 200] [--review-slug pr112] [--json]`
(e.g. the cause of a failed job execution: `catladder logs dev:web --job migrate --execution r8hjv`).
It runs `gcloud logging read` as the local access service account with a
throwaway `CLOUDSDK_CONFIG`; `~/.config/gcloud` and ADC are never read or
written. Entries are oldest first, with a default window of `--since 1h`.
Log output goes to stdout; `--json` prints only a JSON array. It
fails with a pointer to `project setup` / `catenv` when the declaration
or the key file is missing. Review envs need `--review-slug`.

The `vertex` preset grants `roles/aiplatform.user` (to call Vertex AI
models, e.g. local evals). It is **not** read-only: it can use and bill
every Vertex AI API of the project and create/change/delete Vertex AI
resources; it is only accepted as a preset, never in `roles`. Add
`credentialsEnvVar: "GOOGLE_APPLICATION_CREDENTIALS"` (in one env only)
to have catenv export the key path under that name as well, so google
client libraries use it without `gcloud auth application-default login`.
The variable lands in the component's `.env` (e.g. `apps/web/.env`), not
in a root `.env`: scripts run from the repo root must load that file
(`node --env-file-if-exists=apps/web/.env …`).

## Related skills

- `catladder-config` — general catladder.ts structure and regeneration
- `catladder-builds` — build-time vars (`jobVars`) and build config
- `catladder-deploys` — runtime deploy config
- `catladder-pipelines` — how the generated pipelines work
- `catladder-cli` — non-interactive CLI usage and command reference
- `catladder-migrate-ci-backend` — moving between CI backends (the vault
  is what blocks decommissioning the old one)
