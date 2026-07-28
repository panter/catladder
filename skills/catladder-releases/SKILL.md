---
name: catladder-releases
description: How releases work in a catladder project — the `releases` config in catladder.ts (manual vs automatic releasing, and the release method: semantic-release from conventional commits, or changesets from `.changeset/*.md` files), the version/tag/changelog flow, and the security-audit gate that every release must pass. Use when enabling or changing releases, deciding between semantic-release and changesets, writing changesets, cutting or debugging a release, or when a release job fails on the security audit. Triggers on "release", "releases config", "semantic-release", "changesets", "changeset", "version bump", "tag a release", "security audit", "release failed".
---

# Releases with catladder

A release is what produces a `vX.Y.Z` git tag (with a changelog), which
in turn triggers the `taggedRelease` pipeline that deploys to `stage`
and `prod` (see the `catladder-pipelines` skill). Enable it in
`catladder.ts`:

```ts
releases: {
  when: "auto",              // "manual" (default) | "auto"
  method: "semantic-release", // "semantic-release" (default) | "changesets"
}
```

Change `catladder.ts` and regenerate (`yarn catenv`) — the release jobs
are generated, never hand-edited.

## `when` — who triggers the release

- **`manual`** (default) — the `create release` job on the main branch
  can be clicked **at any time**, even while the pipeline is still
  running: it queues the release, which then runs automatically as soon
  as every other job of the pipeline succeeded (and is skipped if the
  pipeline fails). Clicking after a green pipeline releases right away.
  - On GitLab the button is a quick no-op job; the actual release runs
    in the automatic `🚀 release once pipeline succeeds` job (skipped
    when the button was never clicked — never run it by hand).
  - On GitHub, releasing is the **`🚀 catladder create release`**
    workflow (Actions sidebar → Run workflow): it releases immediately
    when the main workflow for HEAD is green, queues the release when
    it is still running (the `🛠️ catladder release on green` workflow then
    picks it up on completion), and fails when the run concluded red.
- **`auto`** — the release job runs automatically on every main-branch
  pipeline (it still no-ops when there is nothing to release).

There is always also a **force release** escape hatch that releases
**immediately**, ignoring the state of the pipeline: on GitLab the
manual `⚠️ force create release` job, on GitHub the *force* checkbox of
the `🚀 catladder create release` workflow. With `method: "changesets"`
forcing has an extra meaning: it releases **even when no changesets are
pending** (patch bump with a generic changelog entry) — the recovery
path when a change was merged without a changeset and must ship now.

On GitHub, other manual tasks are split into per-kind dispatch
workflows the same way (`▶️ catladder deploy`, `⏹️ catladder stop`,
`↩️ catladder rollback`), each with a dropdown of its tasks.

## `method` — how the version is decided

### `semantic-release` (default)
The version is derived automatically from **conventional commit
messages** since the last release (`fix:` → patch, `feat:` → minor,
`BREAKING CHANGE` → major). Nothing to declare by hand — just write
conventional commits.

### `changesets`
Developers declare changes intentionally as **`.changeset/*.md` files**
(the official changesets format: a bump type + a human-written summary).
The release job consumes all pending changesets, takes the highest bump,
computes the next version from the last `v*` git tag, writes the
changelog, commits `chore(release): <version>`, and pushes the tag. An
empty `.changeset/` folder means there is nothing to release.

Add a changeset by creating `.changeset/<name>.md`:

```md
---
"my-app": minor
---

Add the new export endpoint.
```

**When you (an agent) make a user-facing change in a changesets
project, add a changeset file in the same MR** — bump level `major`
(breaking) / `minor` (feature) / `patch` (fix), and a one-to-two
sentence summary written for the changelog reader. Docs/chore-only
changes need none. The package name in the frontmatter is ignored
(versions come from git tags); only the bump counts.

### The changeset check (MR/PR pipelines)

Changesets projects get a **`🦋 changeset check`** job in every
merge-request pipeline. It reports what merging would do — the
changesets this MR adds, everything pending, and the version the next
release would get (with a changelog preview) — and **warns without
blocking** (`allow_failure`) when the MR adds no changeset:

- **GitLab**: report in the job log and as an exposed artifact
  (`changeset-report.md`) in the MR widget. If the project makes
  `GL_TOKEN` available to MR pipelines it also maintains a sticky MR
  comment (opt-in — an api-scope token in MR pipelines is a security
  trade-off).
- **GitHub**: maintains a sticky PR comment via the workflow token.

A yellow changeset-check job on an MR is a prompt to ask: is this
change user-facing? If yes, add a changeset; if not, ignore it.

## The security-audit gate

**Both methods gate on a dependency security audit before releasing.**
The release entrypoint runs the audit first; only if it passes does it
create the version, changelog and tag. On GitLab, if the audit document
is missing or invalid the job opens a merge request with a security-audit
template and **fails** — resolve that MR, then re-run the release. See
the `security` commands in the `catladder-cli` reference.

## Debugging a failed release

- Fails immediately on the audit → handle the security-audit gate above.
- `changesets` released nothing → no `.changeset/*.md` files were
  pending. To ship anyway, force the release (patch bump) — gitlab:
  `⚠️ force create release` job, github: force checkbox — or merge an
  MR adding a changeset describing the accumulated work.
- Wrong version bump → check commit types (semantic-release) or the bump
  levels in the changeset files (changesets).
- Inspect the job with `yarn catladder project ci job-log` (see the
  `catladder-cli` skill).

## Related skills

- `catladder-config` — catladder.ts structure and regeneration
- `catladder-pipelines` — the `taggedRelease` trigger and stage/prod deploys
- `catladder-cli` — `project ci` and `security` commands
