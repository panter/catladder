---
sidebar_position: 7
---

# Releases

Catladder generates a `create release` job (plus a `⚠️ force create release` variant) that creates a versioned release of your application: it bumps the version, writes the changelog and pushes a `vX.Y.Z` git tag. The pushed tag triggers the tagged-release pipeline, which deploys the `stage` and `prod` environments.

Every release first passes the [security audit](./8_security_audit.md) gate.

## Configuration

```ts
const config = {
  // ...
  releases: {
    // "manual" (default): the release job waits for a manual trigger
    // "auto": release on every push to the main branch
    when: "manual",
    // "semantic-release" (default) or "changesets"
    method: "semantic-release",
  },
};
```

## Manual releases: click any time

With `when: "manual"` the `create release` button can be clicked **at any point of the pipeline** — you don't have to wait for it to finish:

- clicked while the pipeline is still running, the release is **queued** and runs automatically as soon as every other job succeeded (nothing happens if the pipeline fails — queue again after fixing it);
- clicked after a green pipeline, the release runs right away.

On GitLab the button is a quick no-op job that records the intent; the actual release runs in the automatic `🚀 release once pipeline succeeds` job (shown as *skipped* in pipelines where nobody clicked — it is never triggered by hand). On GitHub the `create-release` manual task performs the same check itself and, when the main workflow is still running, hands over to the generated `catladder release on green` workflow.

`⚠️ force create release` skips all of this and releases **immediately**, whatever the pipeline state.

## Release methods

### `semantic-release` (default)

Releases are derived from your commit messages ([conventional commits](https://www.conventionalcommits.org/)): `feat:` commits produce a minor release, `fix:`/`docs:`/`perf:` a patch, breaking changes a major. The changelog is generated from the commit history.

This is fully automatic — the flip side is that the changelog reads like a list of commits, and the bump is whatever the commit prefixes imply.

You can customize the behavior by committing your own `.releaserc`; the release job only writes its default config when none exists.

### `changesets`

Releases are declared intentionally: whoever makes a noteworthy change commits a small markdown file to `.changeset/` alongside their MR, stating the bump type and a human-written summary:

```md
---
"my-app": minor
---

Signups can now use their company SSO account
```

The release job consumes all pending changeset files: it takes the highest declared bump, computes the next version from the last `v*` tag, prepends the summaries to `CHANGELOG.md`, commits, tags and pushes. When no changesets are pending, the job succeeds without releasing — to release anyway (e.g. a hotfix was merged without a changeset), the `⚠️ force create release` job releases a patch bump with a generic changelog entry.

#### The changeset check

Every merge-request pipeline gets a **`🦋 changeset check`** job that shows what merging would do: which changesets the MR adds, everything already pending, and the version (plus changelog preview) the next release would carry. When the MR adds no changeset the job turns yellow (`allow_failure`) as a nudge — it never blocks the merge, since docs and chore changes legitimately ship without a changeset.

Where the report appears:

- **GitLab**: in the job log and as an exposed artifact (`changeset-report.md`) linked in the MR widget. If the project chooses to make `GL_TOKEN` available to MR pipelines, the job additionally maintains a sticky MR comment — this is opt-in, because exposing an api-scope token to MR pipelines is a security trade-off.
- **GitHub**: as a sticky PR comment (maintained with the workflow's own token, updated in place on every push).

Authoring:

- In repositories with a `package.json` you can use the official CLI: `yarn changeset` (the file format is the official [changesets](https://github.com/changesets/changesets) format; the declared package names are ignored — only the bump counts, since the version lives in git tags, not in `package.json`).
- In repositories without one (e.g. rails apps), write the file by hand — any file name ending in `.md` inside `.changeset/` works.

Choose changesets when you want the changelog to communicate value to humans and the version bump to be a deliberate decision; choose semantic-release when a mechanical commit-derived log is good enough.

## Versioning

Both methods derive the version from the last `vX.Y.Z` tag reachable from the branch — the first release is `1.0.0`. On hotfix branches (`1.2.x`), the branch's own release line is continued.

## GitHub notes

On the GitHub backend the release job runs in the main workflow (`when: "auto"`) or as a manual task (`workflow_dispatch`). Because tags pushed with the job's `GITHUB_TOKEN` do not trigger `on: push: tags` workflows, the release job explicitly dispatches the generated tagged-release workflow for the new tag — no extra setup (PAT or GitHub App) is needed.
