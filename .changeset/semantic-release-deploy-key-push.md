---
"catladder": patch
---

GitHub: the semantic-release release job now pushes the release commit and tag over ssh with the release deploy key (`CATLADDER_RELEASE_KEY`), so the push passes the merge-gating ruleset instead of failing with `GH013 … Required status check "catladder ✅" is expected` — the changesets path already did. The release commit carries `[skip ci]` on GitHub so the explicitly dispatched tagged-release run stays the only one, the generated tagged-release workflow gets a per-tag concurrency group, and `project doctor` reports a committed release workflow that still runs an older release image (regenerate with `catenv`).
