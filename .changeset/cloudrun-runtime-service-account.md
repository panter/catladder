---
"catladder": minor
---

Cloud Run: new `deploy.runtimeServiceAccount` sets the identity services, jobs and worker pools run as (`--service-account`) instead of the default compute account. Pass an existing account's email, or `{ roles, bucketRoles }` / `true` to let `catladder project setup` create a least-privilege `cl-r-…` account (with `roles/cloudsql.client` for `cloudSql` and object access on volume buckets). `project setup` now retries IAM bindings while a freshly created service account is not yet visible, and `project doctor` checks the runtime account and warns when a component runs as a default compute account with `roles/editor`.
