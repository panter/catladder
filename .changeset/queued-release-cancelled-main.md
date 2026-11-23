---
"@catladder/cli": patch
---

GitHub: a release queued via `🚀 catladder create release` no longer gets lost when its main workflow run is replaced by a newer push (main concurrency ends the pending run as cancelled). The release-on-green guard now moves the queued release on to the newer main commit and releases when that commit's run succeeds; every marker change is a compare-and-swap, so a queued release runs at most once. The guard job additionally gets `actions: read`.
