# Changesets

This repo releases with catladder's `changesets` release method: every
user-facing change merges together with a changeset file in this
directory, and the release job consumes all pending changesets — the
highest bump (from the last `v*` tag) becomes the new version, the
summaries become the changelog entries.

Write one by hand (`.changeset/<descriptive-name>.md`):

```md
---
"catladder": minor
---

One or two sentences describing the change from the user's perspective.
```

Bump levels: `major` (breaking), `minor` (feature), `patch` (fix).
The package name in the frontmatter is ignored (catladder versions via
git tags, not package.json) — only the bump counts. `yarn changeset`
also works if you prefer the interactive prompt.

No pending changesets on main means the release job is a no-op.
