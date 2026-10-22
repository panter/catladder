---
"catladder": patch
---

Fix: on GitHub, a review app label added while the PR's CI is still running is no longer left without a deploy and without a status. The deploy workflow's guard defers (the CI isn't finished) and now sets the commit status `catladder review app` to `pending` ("waiting for the CI"); once `catladder ✅` is green the review workflow's trigger job reads the labels again and starts the deploy.
