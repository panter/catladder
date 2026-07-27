---
"catladder": minor
---

Configurable release method: `releases.method` chooses between `"semantic-release"` (default, commit-message driven) and `"changesets"` (intentional releases declared in `.changeset/*.md`, version derived from git tags — no root package.json required). Both methods share the same release job, changelog maintenance and mandatory security-audit gate.
