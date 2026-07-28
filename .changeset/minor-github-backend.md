---
"catladder": minor
---

GitHub Actions backend: `pipelines: { gitlab: true, github: true }` generates workflows for both CI systems in parallel from one config, including build, deploy, review-environment and release jobs. Job scripts are externalized into committed files instead of being inlined into the workflow yaml.
