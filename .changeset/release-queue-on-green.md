---
"catladder": minor
---

Manual releases can now be queued while the pipeline is still running: the `create release` button is clickable from the first second of a main-branch pipeline and the release then runs automatically as soon as every other job succeeded (clicking after a green pipeline releases right away; a failed pipeline skips the queued release). On GitLab this is a no-op button job plus an automatic `🚀 release once pipeline succeeds` executor; on GitHub the `create-release` task queues a marker that the new `catladder release on green` workflow picks up when the main workflow completes. `⚠️ force create release` still releases immediately, ignoring the pipeline state. Side effect on GitLab: main-branch pipelines now end as *passed* (with a skipped executor) instead of *blocked* when nobody clicks the release button.
