---
"catladder": minor
---

Secrets vault: the secret source of truth is configurable (`gitlab` legacy, `bitwarden`), with a local cache and CI mirroring. Secrets are classified as secret vs. variable, can be synced to GitHub per environment (`secrets-sync-github --env`), and new scoped, non-interactive commands (`secrets pull/push/set/list`) make secret management scriptable and agent-friendly.
