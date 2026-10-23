---
"catladder": minor
---

New `localAccess` declaration (project default, overridable per environment): `project setup` provisions a read-only GCP service account per Cloud Run component/env with exactly the declared roles (`logs` preset = `roles/logging.viewer`; only a short allow-list of safe roles, anything else needs `allowAnyRole`) and stores its key in the secret store (never as a CI variable). `catenv` writes the key to a gitignored 0600 file and exports its path, `project doctor` reports missing/extra bindings and key drift.
