---
"catladder": minor
---

Two new agent skills guide migrations that used to be tribal knowledge: `catladder-migrate-release-method` walks a project from semantic-release to changesets (or back), including backfilling changesets for everything merged since the last release tag so the changelog and version bump stay correct — asking how to group the changes when the history is large or ambiguous. `catladder-migrate-ci-backend` guides a move between GitLab CI and GitHub Actions: the blockers to check up front, running both backends in parallel via `pipelines`, mirroring secrets, the vault and registry consequences, and the manual cleanup a cut-over needs.
