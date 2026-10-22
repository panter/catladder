---
"catladder": patch
---

Fix: on GitHub, the review deploy guard no longer re-reads the `catladder ✅` check for a deploy the review run itself dispatched (`source: ci`). The trigger job runs after the aggregate check succeeded, and reading the check again raced the checks api: a deploy dispatched 17 s after the check completed was skipped as "not finished yet" and nobody retried (zue-zuerich-tourismus#159). A ci dispatch now only verifies that the PR is open and still on that head. Manual dispatches keep the full check.
