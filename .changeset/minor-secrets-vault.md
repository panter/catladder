---
"catladder": minor
---

Secrets vault: the source of truth for secrets is configurable (`gitlab` for the legacy behavior, `bitwarden`), with a local cache and mirroring into CI. Vault values are classified as secret or variable, so non-sensitive configuration is no longer masked and hidden like a password.
