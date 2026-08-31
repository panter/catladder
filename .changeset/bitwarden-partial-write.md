---
"catladder": patch
---

Fixed the bitwarden vault dropping secrets on a partial write: it rewrote an env/component's whole yaml note from the keys of that one write, so `project secrets-set dev:web API_KEY` deleted every other secret of `dev:web` from the vault. Writes are now merged into the existing note, matching the gitlab vault's upsert semantics.
