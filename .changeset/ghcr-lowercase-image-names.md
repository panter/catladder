---
"@catladder/cli": patch
---

fix(github): lowercase the GHCR image paths of mixed-case repositories

GHCR image repository names may not contain uppercase characters, but
`${{ github.repository }}` interpolates GitHub's display casing. Any
project whose GitHub owner or repo name has an uppercase letter (common
for org logins like `AcmeCorp`) therefore failed **every** docker job
client-side, before any network call:

```
invalid tag "ghcr.io/AcmeCorp/nautilus/catladder/docker-build:b343b099980e":
repository name must be lowercase
```

catladder now resolves the repository from the git remote at generation
time and writes the lowercased path (`ghcr.io/acmecorp/nautilus`) into
both the workflow-level `CL_REGISTRY_IMAGE` and the `jobs.<id>.container.image`
of every containerized job — the latter is resolved before any step
runs, so it could not have been fixed from a shell step. GHCR serves the
org under that lowercased namespace, so it is the correct address, not a
workaround.

All-lowercase repositories are unaffected: they keep the
`${{ github.repository }}` expression, which stays correct in forks, so
generated output is byte-identical to before.

Set `pipelines.github.repository` when generation cannot see the git
remote:

```ts
pipelines: { github: { repository: "AcmeCorp/Nautilus" } },
```

`catladder project doctor` now reports a mixed-case repository whose
generated workflows still carry the expression.

**If you worked around this by hand-editing the generated workflows,
revert those edits after upgrading** — `.envrc` runs `eval "$(catenv)"`
on every `cd` into the repo, so regeneration overwrites them anyway.
