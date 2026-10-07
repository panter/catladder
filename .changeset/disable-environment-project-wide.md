---
"catladder": minor
---

`environments: { <name>: false }` disables an environment for the whole project: no component gets it, so `catladder project setup`, secrets (vault, `config-secrets`, `secrets-sync-github`), generated GitLab jobs / GitHub workflows and catenv all skip it — e.g. `environments: { stage: false }` for a project without stage. Previously this needed `env.<name>: false` on every component. `environments.<name>.on: false` is unchanged and now documented accurately: it keeps the env (setup, secrets, catenv) and only never deploys it from a pipeline.
