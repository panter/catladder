---
"catladder": minor
---

The catladder store: `.catladder-store/store.yml` is a committed, non-secret record of machine-fetched facts (currently gcloud project numbers), populated by `catladder project setup`. It makes Cloud Run URLs deterministic at generation time, so generating a pipeline no longer requires cloud access or authentication.
