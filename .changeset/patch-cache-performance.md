---
"catladder": patch
---

Faster pipelines through better caching: node caches are keyed by lockfile content on GitHub, the yarn cache download is skipped entirely when `node_modules` hits exactly, and lint/test jobs pull the node caches without pushing them back.
