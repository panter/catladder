---
"catladder": minor
---

New top-level `reviewApps` config: decide whether merge/pull requests deploy their review apps — every MR/PR (`deploy: "auto"`, default), opt-in or opt-out by label (`optIn` / `optOut`, labels `catladder:review-app` / `catladder:no-review-app`), or only on request (`manual`) — and what drafts run (`drafts: "full" | "ci" | "none"`). With anything but the defaults, the docker → deploy → verify chains of all components wait for one switch per MR/PR, so pipelines no longer build docker images for review apps nobody deploys; tests, lint and audit always run.

- GitHub: the chains move into a new `▶️ catladder deploy review` workflow. The review workflow dispatches it once green when the policy says so, switching the label on deploys right away (off stops the review apps), and anyone can dispatch it with a PR number (`gh workflow run catladder-deploy-review.yml --ref <branch> -f pr=<n>`). Its guard reuses the PR's green `catladder ✅` instead of rerunning tests.
- GitLab: a `🚀 deploy review` job is the switch — automatic or manual depending on labels and draft state, with `allow_failure` so an unplayed switch keeps the pipeline green. `catladder mr review-app-on` / `review-app-off` set the label and trigger a pipeline (gitlab doesn't start one for label changes).

Fix: on GitHub, a review deploy with `when: "manual"` no longer removes the whole review workflow (tests, lint and the required `catladder ✅` check disappeared) and no longer deploys to a shared `…-review-unknown` instance — it now runs through the same review deploy workflow with the PR number.
