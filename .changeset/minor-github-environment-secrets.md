---
"catladder": minor
---

GitHub environment secrets: secrets are scoped per environment instead of per repository, so `stage` and `prod` can hold different values for the same variable. `secrets-sync-github` takes an `--env` filter to sync a single environment.
