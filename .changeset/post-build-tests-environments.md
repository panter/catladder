---
"@catladder/cli": minor
---

`postBuildTests` entries take `environments`: the env names the test runs in, e.g. `e2e: { command: "yarn e2e", environments: ["dev"] }` runs the full e2e suite only on the main branch and not on every merge/pull request push. Works for component and workspace builds (which have no per-env overrides); unknown env names fail the generation.
