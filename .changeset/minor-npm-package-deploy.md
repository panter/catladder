---
"catladder": minor
---

New `npmPackage` deploy type: publishes a component to npm, deriving version and dist-tag from the pipeline trigger — tagged releases publish the tag version as `latest`, branches and merge requests publish `0.0.0-<slug>-<sha>` canaries (with `next`/`beta` branches getting their own dist-tag). Works in workspace monorepos and authenticates via the `NPM_TOKEN` secret.
