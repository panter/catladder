---
"@catladder/cli": minor
---

GitHub: `pipelines.github.runner` sets the runners of the generated jobs — a literal `runs-on` label or a third-party provider (`{ provider: "blacksmith", vcpu }`, `{ provider: "celesto", size }`), with per-job (`jobs`), per-environment (`environments`) and housekeeping (`light`) runners. Without it every job keeps `ubuntu-latest`. New agent skill `catladder-github-runners` covers measuring the Actions bill, estimating savings, the data-protection decision and the provider setup.
