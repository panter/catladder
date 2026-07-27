---
"catladder": minor
---

CI companion & project state: `catci`, a tree-shaken companion bundle materialized into `.catladder-generated/`, now runs release and audit logic in CI. The committed `.catladder-store/store.yml` records machine-fetched facts (e.g. gcloud project numbers), enabling deterministic Cloud Run URLs without cloud access at generation time. `catladder project doctor` detects config/infrastructure drift.
