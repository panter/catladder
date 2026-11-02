---
"catladder": minor
---

`localAccess.db: "readonly"`: `project setup` creates a SELECT-only Postgres role (`catladder_readonly`) for cloud run components with `cloudSql` and grants the local access service account `roles/cloudsql.client` (project-wide) for the Cloud SQL proxy. The credentials land in the local secret store and `catenv` writes them to a gitignored `db-<env>-<component>.env` file (path in `CATLADDER_LOCAL_ACCESS_DB_<ENV>_ENV_FILE`). The project default skips `prod` (opt in with `{ mode: "readonly", allowProd: true }`); review envs are not provisioned.
