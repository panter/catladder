# sandbox E2E harness

Runs a fixture against the **disposable sandbox project** and asserts
the resulting *real* CI pipelines — the layer snapshot tests can't see:
published-package assets, runner token permissions, trigger wiring
(tag → workflow), release flows. Every real bug of the catladder-5
cycle lived in this layer while snapshots stayed green.

Sandbox repos (echo-only deploys; runs cut real releases there — that's
their purpose):

- gitlab `catladder/release-sandbox` (remote `origin` in the sandbox checkout)
- github `panter/catladder-release-sandbox` (remote `github`)
- local checkout expected at `../catladder-release-sandbox` relative to
  this repo (see `SANDBOX` in `run.mjs`)

## Usage

```bash
yarn e2e <fixture> --backend github        # or gitlab, or github,gitlab
yarn e2e <fixture> --backend github --tgz /path/to/catladder-cli.tgz
yarn e2e <fixture> --static-only           # generation assertions only, no push
```

Without `--tgz` the cli is built and packed from **this checkout** — use
`--tgz` to test a build from another branch/merge.

Requires authenticated `gh` and `glab` CLIs and push access to both
sandbox remotes.

## Fixtures

A fixture is a directory under `fixtures/<name>/`:

- `catladder.ts` — the sandbox config to test (copied verbatim)
- `files/` — optional extra files copied into the sandbox (e.g. `.changeset/`)
- `expect.mjs` — per-backend expectations:
  - `static`: `{file, contains, notContains}` checks on generated files
  - `mainRun` / `mainPipeline`: `{jobName → success|failed|manual|skipped|absent}`
    for the pipeline triggered by the push
  - `tagRun` / `tagPipeline`: same, for the tag pipeline the release job triggers
  - `dispatches` (github): `workflow_dispatch` steps to fire and assert

## Phases

- **Phase 1 (this)**: manual invocation.
- Phase 2 (planned): scheduled / label-gated job in catladder's own CI,
  sandbox push tokens as CI secrets.
- Phase 3 (idea): ephemeral per-run sandbox repos created+destroyed via
  API — removes cross-run state (diverging version history).
