---
"@catladder/cli": minor
---

gitlab: reliably cancel superseded pipelines

Pushing a new commit to a merge request did not always cancel the
previous pipeline. The release jobs and the `🦋 changeset check` job
were written directly as gitlab job definitions and so bypassed the
`interruptible: true` default every other job gets — gitlab defaults a
job without the keyword to `interruptible: false`, and under its
default `conservative` auto-cancel mode a single such job that has
*started* shields the entire pipeline from cancellation. Whether
`🦋 changeset check` had started when you pushed decided whether the
old MR pipeline died, which is why it looked intermittent.

Every generated gitlab job now carries an explicit `interruptible`, and
the generated `workflow:` states the policy directly:

| pipeline | on a new commit |
|---|---|
| merge request | cancelled |
| main branch (dev) | cancelled, except a release already running |
| tagged release | runs through |
| agent run (`trigger`) | runs through |

Note that this only tunes gitlab's behaviour — **Settings > CI/CD >
General pipelines > Auto-cancel redundant pipelines** must be enabled
on the project, otherwise nothing is ever cancelled.
