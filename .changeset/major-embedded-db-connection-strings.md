---
"catladder": major
---

Cloud Run `DATABASE_URL` / `DATABASE_JDBC_URL` now default to `dbConnectionStringVariablesMode: "embedded"`: connection strings contain the component's final values instead of `$DB_USER`/`$DB_PASSWORD` placeholders, making them referenceable from other components (`${otherComponent:DATABASE_URL}`). Embedded mode also respects `vars.public` overrides of the `DB_*` vars — a component reusing another component's database via `dbBaseName` plus `DB_PASSWORD: "${owner:DB_PASSWORD}"` now gets the owner's password in its connection string (previously the component's own, usually unset, secret was embedded, producing a password-less URL). The deployed runtime values are unchanged for the common cases, since legacy placeholders were expanded at deploy time anyway — but the generated pipeline YAML changes for every project with `cloudSql`. Set `dbConnectionStringVariablesMode: "legacy"` to restore the old behaviour; that escape hatch will be removed in a future major.
