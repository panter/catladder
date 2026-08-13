---
"catladder": minor
---

The `pages` deploy type now works on the github backend. The deploy job hands the built site to `actions/upload-pages-artifact` + `actions/deploy-pages`, targets the `github-pages` environment and reports the published url from the deploy step, with `pages: write` / `id-token: write` granted on the job. The repository's Pages source must be set to "GitHub Actions" once. Per-merge-request previews stay gitlab-only: github serves one site per repository and `deploy-pages` replaces all of it, so review environments log why they were skipped instead of generating a deploy job.
