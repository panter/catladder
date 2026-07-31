---
"catladder": minor
---

The github review workflow gains a generated **`catladder ✅`** job that succeeds exactly when every other review job succeeded (`needs:` all of them, `if: always()`, skipped counts as failed; `continue-on-error` jobs like the audit stay non-blocking). It exists to be the **one required status check** in branch protection: requiring real job names goes stale on every component change — a renamed required job blocks its own PR forever, a new component's jobs are silently not required — while this context never changes. Combined with the repo's "Allow auto-merge" setting this restores gitlab's built-in "merge when pipeline succeeds" on github.
