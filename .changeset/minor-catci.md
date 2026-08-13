---
"catladder": minor
---

`catci`, catladder's CI companion: a tree-shaken bundle materialized into `.catladder-generated/catci/` on generation, running the release, security-audit and npm-publish logic in CI with plain `node`. Job images no longer need catladder installed, and CI always runs exactly the version that generated the pipeline.
