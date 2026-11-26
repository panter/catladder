---
"@catladder/cli": minor
---

github: `pipelines.github.runner.release` sets the runner of the release jobs (create release, release on green) separately from `light`, so the short housekeeping jobs can move to a provider's smallest size (e.g. celesto `micro`) while the jobs holding the release deploy key stay on `ubuntu-latest`. Defaults to `light`.
