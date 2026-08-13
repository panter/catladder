---
"catladder": patch
---

GitHub: the release job pushes with a provisioned deploy key, making it
compatible with merge gating.

The previous fix put the required `catladder ✅` check into a ruleset
with a bypass for the GitHub Actions app — but github refuses the
built-in actions app on bypass lists by design (any collaborator could
push anywhere by authoring a workflow), so the release push was still
blocked.

`project setup` now provisions a **release deploy key**: an ed25519
write deploy key on the repository, its private half stored as the
`CATLADDER_RELEASE_KEY` actions secret, and a deploy-key bypass on the
merge-gating ruleset. The generated release jobs hand the secret to
catci, which pushes the release commit and tag over ssh with it — the
only actor that can pass the gating. Deploy keys are repo-scoped, only
admins can add them, and they never expire (no yearly renewal like
gitlab's `GL_TOKEN`). Without the secret the job falls back to pushing
with the workflow token, which keeps working for repositories without
merge gating.

Because deploy-key pushes trigger workflows (unlike workflow-token
pushes), the release commit now carries `[skip ci]` on github — the
explicitly dispatched taggedRelease workflow stays the only release
run, and the release commit no longer triggers a redundant main
pipeline. On gitlab the commit message is unchanged (the tag pipeline
must fire natively there).

`project doctor` verifies the key, the secret and the ruleset bypass,
and the changesets job image now ships an ssh client. `project setup`
also no longer tries to set the gitlab project topic on github-only
projects (it crashed with "not found" before reaching the github
steps).
