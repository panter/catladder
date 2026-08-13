---
"catladder": patch
---

`semantic-release` on the github backend now creates the entry on the releases page too, via `@semantic-release/github` (the counterpart of the gitlab publish plugin, which is gitlab-only — on github the release used to end at the tag). Only the release is created: commenting on released pull requests/issues and labelling them stays off, so the release job keeps its `contents: write`-only permissions. Projects with their own `.releaserc` are unaffected, as before.
